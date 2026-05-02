import type { FrameSource } from './FrameSource.ts';

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
