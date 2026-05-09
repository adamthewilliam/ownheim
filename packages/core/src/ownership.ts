import { AsyncLocalStorage } from 'node:async_hooks';
import { callerFrameSource, findOwnedFrame, type FrameSource } from './resolution/frames.ts';
import { getDefaultRegistry } from './manifest/defaultRegistry.ts';
import { walkOwnedErrorChain } from './resolution/walkOwnedErrorChain.ts';

/**
 * The single source of truth for "who owns this code path right now".
 *
 * `ownership.ts` unifies what was previously split across `scope/` and
 * `resolution/`: the runtime ALS that propagates owner across async
 * boundaries, the helpers that wrap framework middleware, and the
 * priority chain that resolves an owner from errors / scope / stack
 * frames / module declarations / fallback.
 *
 * The split was artificial — `resolveOwner`'s tier-2 (active scope) is
 * literally a read of the same ALS that `runWithOwner` writes. Keeping
 * them in one module makes the behavioural contract readable in one
 * place and lets the AsyncLocalStorage stay private.
 */

const ownerStore = new AsyncLocalStorage<string>();

// ---------------------------------------------------------------------------
// Scope: write + read the active owner across async boundaries.
// ---------------------------------------------------------------------------

export function runWithOwner<TResult>(owner: string, fn: () => TResult): TResult {
  return ownerStore.run(owner, fn);
}

export function currentOwner(): string | undefined {
  return ownerStore.getStore();
}

/**
 * A thunk that yields control to whatever the framework considers "next".
 * The return type is intentionally `unknown` — frameworks discard, await, or
 * forward this value as their signature requires.
 */
export type NextThunk = () => unknown;

/**
 * Build a framework-shaped middleware factory.
 *
 * `pickNext` extracts the framework's continuation from its native call args.
 * The returned factory takes an owner id and yields a middleware whose call
 * shape is exactly `(...args) => TReturn`.
 *
 * Behavioral guarantees:
 *  - The continuation runs inside `runWithOwner(owner, ...)`.
 *  - Whatever the continuation returns is returned directly to the framework.
 *  - The owner scope does not leak past the synchronous return of `pickNext`.
 */
export function withOwnerScope<TArgs extends readonly unknown[], TReturn = unknown>(
  pickNext: (...args: TArgs) => NextThunk,
): (owner: string) => (...args: TArgs) => TReturn {
  return (owner) =>
    ((...args: TArgs) => runWithOwner(owner, () => pickNext(...args)())) as (
      ...args: TArgs
    ) => TReturn;
}

// ---------------------------------------------------------------------------
// Resolution: the priority chain that maps a context (error / scope /
// frames / module declaration / fallback) onto a single owner id.
// ---------------------------------------------------------------------------

/**
 * The tier in `resolveOwner`'s chain that produced the owner.
 *
 * The Datadog/Sentry/OTel adapters can emit it as `team_source` alongside
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

export function resolveOwnerWithSource(input: ResolveOwnerInput = {}): OwnerResolution {
  // 1. Owned-error chain.
  if (input.error !== undefined) {
    const fromError = walkOwnedErrorChain(input.error);
    if (fromError !== undefined) return { owner: fromError, source: 'error' };
  }

  // 2. Active ALS scope — same store `runWithOwner` writes to.
  const fromScope = ownerStore.getStore();
  if (fromScope !== undefined) return { owner: fromScope, source: 'scope' };

  // 3. Frame source -> manifest. Default: caller stack, skipping
  //    [resolveOwnerWithSource, this caller] => skip 2.
  const frameSource: FrameSource = input.frameSource ?? callerFrameSource(2);
  const fromFrame = findOwnedFrame(frameSource, getDefaultRegistry());
  if (fromFrame !== undefined) return { owner: fromFrame, source: 'frame' };

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
