import { currentOwner } from '@strays/runtime/currentOwner';
import { getDefaultRegistry } from '@strays/runtime/defaultRegistry';
import type { ManifestRegistry } from '@strays/runtime/ManifestRegistry';
import { walkOwnedErrorChain } from '@strays/runtime/walkOwnedErrorChain';

export interface SentryFrame {
  readonly filename?: string;
  readonly in_app?: boolean;
}

export interface SentryStacktrace {
  readonly frames?: readonly SentryFrame[];
}

export interface ResolveOwnerOptions {
  readonly fallback?: string;
  readonly registry?: ManifestRegistry;
}

const VENDOR_PATTERNS = [/\/node_modules\//, /^node:/, /\(internal\//];

export function resolveOwnerFromEvent(
  exception: unknown,
  stacktrace: SentryStacktrace | undefined,
  fallbackOrOpts: string | ResolveOwnerOptions = 'unowned',
): string {
  const opts: ResolveOwnerOptions =
    typeof fallbackOrOpts === 'string' ? { fallback: fallbackOrOpts } : fallbackOrOpts;
  const fallback = opts.fallback ?? 'unowned';
  const registry = opts.registry ?? getDefaultRegistry();
  return (
    walkOwnedErrorChain(exception) ??
    currentOwner() ??
    resolveFromStackFrames(stacktrace, registry) ??
    fallback
  );
}

function resolveFromStackFrames(
  stacktrace: SentryStacktrace | undefined,
  registry: ManifestRegistry,
): string | undefined {
  if (!stacktrace?.frames) return undefined;
  for (let i = stacktrace.frames.length - 1; i >= 0; i--) {
    const frame = stacktrace.frames[i];
    const file = frame?.filename;
    if (!file) continue;
    if (frame?.in_app === false) continue;
    if (VENDOR_PATTERNS.some((p) => p.test(file))) continue;
    const owner = registry.lookupOwner(file);
    if (owner !== undefined) return owner;
  }
  return undefined;
}
