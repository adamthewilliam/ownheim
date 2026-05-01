import { Context, Effect, Layer } from 'effect';

export class Owner extends Context.Tag('@strays/Owner')<Owner, string>() {
  static layer(owner: string): Layer.Layer<Owner> {
    return Layer.succeed(Owner, owner);
  }
}

export const withOwner =
  (owner: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, Exclude<R, Owner>> =>
    effect.pipe(Effect.provideService(Owner, owner), Effect.annotateLogs('team', owner));
