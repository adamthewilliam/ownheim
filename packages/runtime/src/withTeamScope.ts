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
 * The returned factory takes a team name and yields a middleware whose call
 * shape is exactly `(...args) => TReturn`.
 *
 * Behavioral guarantees:
 *  - The continuation runs inside `runWithOwner(team, ...)`.
 *  - Whatever the continuation returns is returned directly to the framework
 *    (so async frameworks can `await` it, sync frameworks see `undefined`).
 *  - The owner scope does not leak past the synchronous return of `pickNext`.
 */
export function withTeamScope<TArgs extends readonly unknown[], TReturn = unknown>(
  pickNext: (...args: TArgs) => NextThunk,
): (team: string) => (...args: TArgs) => TReturn {
  return (team) =>
    ((...args: TArgs) => runWithOwner(team, () => pickNext(...args)())) as (
      ...args: TArgs
    ) => TReturn;
}
