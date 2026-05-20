import { describe, expect, it } from 'bun:test';
import { Effect, Logger as EffectLogger, Schema } from 'effect';
import { OwnedError } from '@ownheim/core/OwnedError';
import { walkResponderTeamChain } from '@ownheim/core/resolution/walkOwnedErrorChain';
import { withOwnershipLogAnnotations } from '@ownheim/effect/Logging';
import { withOwnershipSpan } from '@ownheim/effect/Tracer';
import { ownedBy } from '@ownheim/effect/ownedBy';

class BillingTaggedError extends Schema.TaggedError<BillingTaggedError>(
  'BillingTaggedError',
)('BillingTaggedError', { code: Schema.String }) {}
ownedBy(BillingTaggedError, 'Billing');

describe('@ownheim/effect integration', () => {
  it('ownedBy marks Schema.TaggedError failures for responder resolution', async () => {
    const exit = await Effect.runPromiseExit(Effect.fail(new BillingTaggedError({ code: 'CARD_DECLINED' })));

    expect(exit._tag).toBe('Failure');
    if (exit._tag === 'Failure') {
      const cause = exit.cause as { _tag: string; error?: unknown };
      expect(cause._tag).toBe('Fail');
      expect(walkResponderTeamChain(cause.error)).toBe('Billing');
    }
  });

  it('ownedBy responder ownership is discoverable through Error.cause chains', () => {
    const root = new BillingTaggedError({ code: 'DECLINED' });
    const wrapped = new Error('wrapped', { cause: root });

    expect(walkResponderTeamChain(wrapped)).toBe('Billing');
  });

  it('OwnedError still wins explicitly for Effect failure causes', async () => {
    const exit = await Effect.runPromiseExit(
      Effect.fail(new OwnedError('boom', { responderTeam: 'Identity' })),
    );

    expect(exit._tag).toBe('Failure');
    if (exit._tag === 'Failure') {
      const cause = exit.cause as { _tag: string; error?: unknown };
      expect(walkResponderTeamChain(cause.error)).toBe('Identity');
    }
  });

  it('withOwnershipLogAnnotations adds native Effect log annotations across async effects', async () => {
    const annotations: Record<string, unknown>[] = [];
    const logger = EffectLogger.make(({ annotations: logAnnotations }) => {
      annotations.push(Object.fromEntries(logAnnotations));
    });

    await Effect.runPromise(
      Effect.gen(function* () {
        yield* Effect.sleep('1 millis');
        yield* Effect.logInfo('charged');
      }).pipe(
        withOwnershipLogAnnotations({ moduleOwner: 'Billing' }),
        Effect.provide(EffectLogger.replace(EffectLogger.defaultLogger, logger)),
      ),
    );

    expect(annotations).toHaveLength(1);
    expect(annotations[0]?.['ownheim.code_team']).toBe('Billing');
  });

  it('withOwnershipSpan wraps real Effect execution without changing success or failure semantics', async () => {
    const success = await Effect.runPromise(
      Effect.succeed('ok').pipe(withOwnershipSpan('billing.charge', { moduleOwner: 'Billing' })),
    );
    expect(success).toBe('ok');

    const exit = await Effect.runPromiseExit(
      Effect.fail('nope').pipe(withOwnershipSpan('billing.fail', { moduleOwner: 'Billing' })),
    );
    expect(exit._tag).toBe('Failure');
  });
});
