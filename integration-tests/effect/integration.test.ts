import { describe, expect, it } from 'bun:test';
import { Effect, Fiber, Layer, Logger as EffectLogger, Schema } from 'effect';
import { OwnedError } from '@strays/core/OwnedError';
import { makeMemorySink } from '@strays/core/logging/LogSink';
import { walkResponderTeamChain } from '@strays/core/resolution/walkOwnedErrorChain';
import { Owner, withOwner } from '@strays/effect/Owner';
import { ownedBy } from '@strays/effect/ownedBy';
import { makeOwnershipLogger } from '@strays/effect/Logger';

const provideTestLogger = (sink: ReturnType<typeof makeMemorySink>['sink']) =>
  EffectLogger.replace(EffectLogger.defaultLogger, makeOwnershipLogger(sink));

// ---------- 1. ownedBy decorator on multi-yield Effect.gen ----------

describe('integration: Owner persists across multi-yield Effect.gen', () => {
  it('owner survives every yield in an Effect.gen pipeline', async () => {
    // Multiple sequential yields simulate `await`-equivalents; Owner must
    // remain present in Context across each yield boundary.
    const program = Effect.gen(function* () {
      const a = yield* Owner;
      yield* Effect.sleep('1 millis');
      const b = yield* Owner;
      yield* Effect.sleep('1 millis');
      const c = yield* Owner;
      return [a, b, c] as const;
    });

    const [a, b, c] = await Effect.runPromise(withOwner('Billing')(program));
    expect(a).toBe('Billing');
    expect(b).toBe('Billing');
    expect(c).toBe('Billing');
  });
});

// ---------- 2. Effect.fork — fiber inheritance of Owner ----------

describe('integration: Effect.fork inherits Owner from parent context', () => {
  it('forked child fiber sees the same Owner as its parent', async () => {
    // Effect's Context is part of the effect's R type; `Effect.fork` keeps
    // R unchanged, so the forked fiber inherits whatever Context (including
    // Owner) the parent ran with. Documenting this as the contract.
    const childOwnerRef: { value?: string } = {};

    const program = Effect.gen(function* () {
      const fiber = yield* Effect.fork(
        Effect.gen(function* () {
          const owner = yield* Owner;
          childOwnerRef.value = owner;
          return owner;
        }),
      );
      const result = yield* Fiber.join(fiber);
      return result;
    });

    const result = await Effect.runPromise(withOwner('Identity')(program));
    expect(result).toBe('Identity');
    expect(childOwnerRef.value).toBe('Identity');
  });

  it('forked fibers see overrides applied via inner withOwner', async () => {
    const program = Effect.gen(function* () {
      const fiber = yield* Effect.fork(
        withOwner('Platform')(
          Effect.gen(function* () {
            return yield* Owner;
          }),
        ),
      );
      return yield* Fiber.join(fiber);
    });

    const result = await Effect.runPromise(withOwner('Billing')(program));
    expect(result).toBe('Platform');
  });
});

// ---------- 3. Layered runtime — Owner.layer composition precedence ----------

describe('integration: Owner.layer composition follows last-provided precedence', () => {
  it('resolves Owner from a provided Layer', async () => {
    const program = Effect.gen(function* () {
      return yield* Owner;
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(Owner.layer('Billing'))),
    );
    expect(result).toBe('Billing');
  });

  it('Layer.merge composition: the right-most provide() wins', async () => {
    // When Effect.provide is applied multiple times, each successive
    // application wraps the previous; the layer added LAST (closest to the
    // effect) is the one that resolves first. We pin that ordering as the
    // documented precedence.
    const program = Effect.gen(function* () {
      return yield* Owner;
    });

    const both = program.pipe(
      Effect.provide(Owner.layer('Platform')), // closest -> wins
      Effect.provide(Owner.layer('Billing')),
    );
    const result = await Effect.runPromise(both);
    expect(result).toBe('Platform');
  });

  it('Layer.merge with conflicting Owner layers: Layer composition order wins', async () => {
    // Layer.merge with two Owner-providing layers: Effect's documented
    // semantic is that the right-hand layer overrides the left.
    const merged = Layer.merge(Owner.layer('Billing'), Owner.layer('Platform'));
    const program = Effect.gen(function* () {
      return yield* Owner;
    });
    const result = await Effect.runPromise(program.pipe(Effect.provide(merged)));
    expect(result).toBe('Platform');
  });
});

// ---------- 4. Logger integration: team tag in structured output ----------

describe('integration: ownership Logger emits team tag from withOwner', () => {
  it('Effect.logInfo under withOwner produces a record with team field', async () => {
    const { sink, lines } = makeMemorySink();

    await Effect.runPromise(
      withOwner('Identity')(
        Effect.gen(function* () {
          yield* Effect.logInfo('handler invoked');
        }),
      ).pipe(Effect.provide(provideTestLogger(sink))),
    );

    expect(lines).toHaveLength(1);
    expect(lines[0]?.team).toBe('Identity');
    expect(lines[0]?.record.team).toBe('Identity');
    expect(lines[0]?.record.msg).toBe('handler invoked');
  });
});

// ---------- 5. Effect.race — winner's owner sticks to its logs ----------

describe('integration: Effect.race winner emits its own owner in logs', () => {
  it("the winning fiber's owner annotation is the team in emitted logs", async () => {
    const { sink, lines } = makeMemorySink();

    // Two competing effects, each scoped to a different owner. The winner
    // logs `winner` and races against a slow loser that would log `loser`.
    // Verify that only the winner's log appears AND it carries the winner's
    // owner.
    const fast = withOwner('Billing')(
      Effect.gen(function* () {
        yield* Effect.sleep('1 millis');
        yield* Effect.logInfo('winner');
        return 'billing-won' as const;
      }),
    );

    const slow = withOwner('Platform')(
      Effect.gen(function* () {
        yield* Effect.sleep('200 millis');
        yield* Effect.logInfo('loser');
        return 'platform-won' as const;
      }),
    );

    const result = await Effect.runPromise(
      Effect.race(fast, slow).pipe(Effect.provide(provideTestLogger(sink))),
    );

    expect(result).toBe('billing-won');
    // The winner logged 'winner' under team='Billing'. The loser may be
    // interrupted before it logs; assert at minimum that the only log we see
    // about 'winner' carries Billing.
    const winnerLines = lines.filter((l) => l.record.msg === 'winner');
    expect(winnerLines).toHaveLength(1);
    expect(winnerLines[0]?.team).toBe('Billing');

    // And critically — no 'winner' log should be tagged 'Platform'.
    const crossContaminated = lines.find(
      (l) => l.record.msg === 'winner' && l.team === 'Platform',
    );
    expect(crossContaminated).toBeUndefined();
  });
});

// ---------- 6. Failure path — owner survives Effect.fail in ownedBy ----------

class BillingTaggedError extends Schema.TaggedError<BillingTaggedError>(
  'BillingTaggedError',
)('BillingTaggedError', { code: Schema.String }) {}
ownedBy(BillingTaggedError, 'Billing');

describe('integration: Effect.fail preserves owner via ownedBy / OwnedError', () => {
  it('walkResponderTeamChain finds the owner on a Schema.TaggedError marked with ownedBy', async () => {
    const program = Effect.gen(function* () {
      yield* Effect.fail(new BillingTaggedError({ code: 'CARD_DECLINED' }));
      return 'unreachable';
    });

    const exit = await Effect.runPromiseExit(program);
    expect(exit._tag).toBe('Failure');
    if (exit._tag === 'Failure') {
      // Cause -> Fail -> error
      const cause = exit.cause as { _tag: string; error?: unknown };
      expect(cause._tag).toBe('Fail');
      const err = cause.error;
      expect(walkResponderTeamChain(err)).toBe('Billing');
    }
  });

  it('Logger emits the OwnedError owner as team even when scope owner differs', async () => {
    // Reproduce the unit-test wiring but exercise the full Effect runtime:
    // an OwnedError marked 'Identity' fails inside a withOwner('Platform')
    // scope. The Logger should resolve 'Identity' (cause owner beats scope).
    const { sink, lines } = makeMemorySink();
    await Effect.runPromise(
      withOwner('Platform')(
        Effect.fail(new OwnedError('boom', { responderTeam: 'Identity' })).pipe(
          Effect.tapErrorCause((cause) => Effect.logError('failed', cause)),
          Effect.catchAll(() => Effect.void),
        ),
      ).pipe(Effect.provide(provideTestLogger(sink))),
    );

    expect(lines.length).toBeGreaterThan(0);
    const failureLine = lines.find((l) => l.record.msg === 'failed');
    expect(failureLine?.team).toBe('Identity');
  });
});
