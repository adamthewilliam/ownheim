import { Effect } from 'effect';
import { resolveProjectedOwnershipTags, type ProjectOwnershipInput } from '@ownheim/core/tracing/projectOwnership';

/**
 * Annotates the current Effect span with Ownheim ownership tags resolved from
 * the configured manifest / entrypoint scope / owned error context.
 */
export const annotateOwnershipSpan = (
  input: ProjectOwnershipInput = {},
): Effect.Effect<void, never, never> =>
  Effect.annotateCurrentSpan(resolveProjectedOwnershipTags(input));

/**
 * Wraps an Effect span and annotates it before the wrapped effect runs.
 */
export const withOwnershipSpan =
  (name: string, input: ProjectOwnershipInput = {}) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    Effect.gen(function* () {
      yield* annotateOwnershipSpan(input);
      return yield* effect;
    }).pipe(Effect.withSpan(name));
