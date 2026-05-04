import { runWithOwner } from './runWithOwner.ts';

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
 * Vocabulary note: this lives on the *resolution* side of the input/output
 * boundary, so the parameter is `owner` (the OwnerId, e.g. `"Billing"`). The
 * string is later emitted on telemetry as the `team` tag — that crossover
 * happens in the formatter / span processor, not here.
 *
 * Behavioral guarantees:
 *  - The continuation runs inside `runWithOwner(owner, ...)`.
 *  - Whatever the continuation returns is returned directly to the framework
 *    (so async frameworks can `await` it, sync frameworks see `undefined`).
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
