import { Effect } from 'effect';
import { resolveProjectedOwnershipTags, type ProjectOwnershipInput } from '@ownheim/core/tracing/projectOwnership';

/**
 * Adds Ownheim ownership tags to Effect log annotations for the wrapped effect.
 *
 * This does not replace the user's Effect logger. It only uses Effect's native
 * log annotation mechanism, so whichever logger the application already uses can
 * decide how to render annotations.
 */
export const withOwnershipLogAnnotations =
  (input: ProjectOwnershipInput = {}) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    effect.pipe(Effect.annotateLogs(resolveProjectedOwnershipTags(input)));
