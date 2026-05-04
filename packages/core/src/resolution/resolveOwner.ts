import { callerFrameSource, type FrameSource } from './callerFrameSource.ts';
import { currentOwner } from '../scope/currentOwner.ts';
import { getDefaultRegistry } from '../manifest/defaultRegistry.ts';
import { walkOwnedErrorChain } from './walkOwnedErrorChain.ts';

/**
 * The tier in `resolveOwner`'s chain that produced the owner.
 *
 * Returned by `resolveOwnerWithSource` for callers that need to audit which
 * tier resolved a given owner — most useful during rollout/migration to
 * verify telemetry is being attributed via the expected channel. The
 * Datadog/Sentry/OTel adapters can emit it as `team_source` alongside
 * `team` when `emitSource: true` is passed; off by default to keep
 * production cardinality minimal.
 */
export type OwnerSource = 'error' | 'scope' | 'frame' | 'module' | 'fallback';

export interface OwnerResolution {
  readonly owner: string;
  readonly source: OwnerSource;
}

export interface ResolveOwnerInput {
  /** Throwable-like value whose .cause chain may carry an OWNER_TAG. */
  readonly error?: unknown;
  /** Optional frame source. Defaults to the V8 stack of the calling code. */
  readonly frameSource?: FrameSource | undefined;
  /**
   * Owner declared at module scope (e.g. via `defineStrays` / OWNER constant).
   * Used as a tier-2 fallback before the frame source is consulted.
   */
  readonly moduleOwner?: string | undefined;
  /** Final fallback when no tier yields a team. Defaults to `'unowned'`. */
  readonly fallback?: string | undefined;
}

const VENDOR_PATTERNS = [
  /\/node_modules\//,
  /^node:/,
  /\(node:internal\//,
  /\(internal\//,
];

export function resolveOwnerWithSource(input: ResolveOwnerInput = {}): OwnerResolution {
  // 1. Owned-error chain.
  if (input.error !== undefined) {
    const fromError = walkOwnedErrorChain(input.error);
    if (fromError !== undefined) return { owner: fromError, source: 'error' };
  }

  // 2. Active ALS scope.
  const fromScope = currentOwner();
  if (fromScope !== undefined) return { owner: fromScope, source: 'scope' };

  // 3. Frame source -> manifest. Default: caller stack, skipping
  //    [resolveOwnerWithSource, this caller] => skip 2.
  const registry = getDefaultRegistry();
  const frameSource: FrameSource = input.frameSource ?? callerFrameSource(2);
  for (const file of frameSource.frames()) {
    if (isVendor(file)) continue;
    const owner = registry.lookupOwner(file);
    if (owner !== undefined) return { owner, source: 'frame' };
  }

  // 4. Module-declared owner.
  if (input.moduleOwner !== undefined && input.moduleOwner !== '') {
    return { owner: input.moduleOwner, source: 'module' };
  }

  // 5. Final fallback.
  return { owner: input.fallback ?? 'unowned', source: 'fallback' };
}

export function resolveOwner(input: ResolveOwnerInput = {}): string {
  return resolveOwnerWithSource(input).owner;
}

function isVendor(file: string): boolean {
  return VENDOR_PATTERNS.some((p) => p.test(file));
}
