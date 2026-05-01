import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { Owner, withOwner } from './Owner.ts';

describe('Owner', () => {
  it('exposes the provided owner via Effect.service', async () => {
    const program = Effect.gen(function* () {
      return yield* Owner;
    });

    const result = await Effect.runPromise(program.pipe(Effect.provide(Owner.layer('Billing'))));

    expect(result).toBe('Billing');
  });

  it('withOwner provides both the service and a log annotation', async () => {
    const program = Effect.gen(function* () {
      const owner = yield* Owner;
      return owner;
    });

    const result = await Effect.runPromise(withOwner('Identity')(program));
    expect(result).toBe('Identity');
  });

  it('Effect.serviceOption returns None when Owner is not provided', async () => {
    const program = Effect.gen(function* () {
      const owner = yield* Effect.serviceOption(Owner);
      return owner._tag;
    });

    const result = await Effect.runPromise(program);
    expect(result).toBe('None');
  });

  it('nested withOwner calls override the outer owner', async () => {
    const program = Effect.gen(function* () {
      return yield* Owner;
    });

    const result = await Effect.runPromise(
      withOwner('Billing')(withOwner('Platform')(program)),
    );
    expect(result).toBe('Platform');
  });
});
