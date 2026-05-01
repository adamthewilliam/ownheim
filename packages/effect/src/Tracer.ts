import { Effect, Option } from 'effect';
import { Owner } from './Owner.ts';

export const tagOwnerOnSpan: Effect.Effect<void, never, never> = Effect.gen(function* () {
  const ownerOpt = yield* Effect.serviceOption(Owner);
  const team = Option.getOrElse(ownerOpt, () => 'unowned');
  yield* Effect.annotateCurrentSpan('team', team);
});

export const withOwnedSpan =
  (name: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    effect.pipe(
      Effect.tap(() => tagOwnerOnSpan),
      Effect.withSpan(name),
    );
