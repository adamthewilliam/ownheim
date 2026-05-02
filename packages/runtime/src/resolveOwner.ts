import { callerFrameSource } from './callerFrameSource.ts';
import { currentOwner } from './currentOwner.ts';
import type { FrameSource } from './FrameSource.ts';
import { lookupOwner } from './manifest.ts';
import type { ResolveOwnerInput } from './ResolveOwnerInput.ts';
import { walkOwnedErrorChain } from './walkOwnedErrorChain.ts';

const VENDOR_PATTERNS = [
  /\/node_modules\//,
  /^node:/,
  /\(node:internal\//,
  /\(internal\//,
];

export function resolveOwner(input: ResolveOwnerInput = {}): string {
  // 1. Owned-error chain.
  if (input.error !== undefined) {
    const fromError = walkOwnedErrorChain(input.error);
    if (fromError !== undefined) return fromError;
  }

  // 2. Active ALS scope.
  const fromScope = currentOwner();
  if (fromScope !== undefined) return fromScope;

  // 3. Frame source -> manifest. Default: caller stack, skipping
  //    [resolveOwner, this caller] => skip 2.
  const frameSource: FrameSource = input.frameSource ?? callerFrameSource(2);
  for (const file of frameSource.frames()) {
    if (isVendor(file)) continue;
    const owner = lookupOwner(file);
    if (owner !== undefined) return owner;
  }

  // 4. Module-declared owner.
  if (input.moduleOwner !== undefined && input.moduleOwner !== '') {
    return input.moduleOwner;
  }

  // 5. Final fallback.
  return input.fallback ?? 'unowned';
}

function isVendor(file: string): boolean {
  return VENDOR_PATTERNS.some((p) => p.test(file));
}
