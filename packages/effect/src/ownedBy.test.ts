import { describe, expect, it } from 'bun:test';
import { Effect, Schema } from 'effect';
import { walkResponderTeamChain } from '@strays/core/resolution/walkOwnedErrorChain';
import { ownedBy } from './ownedBy.ts';

class BillingError extends Schema.TaggedError<BillingError>('BillingError')(
  'BillingError',
  { code: Schema.String },
) {}
ownedBy(BillingError, 'Billing');

describe('ownedBy', () => {
  it('preserves the Effect tagged-error _tag discriminant', () => {
    const err = new BillingError({ code: 'CARD_DECLINED' });
    expect(err._tag).toBe('BillingError');
  });

  it('walkResponderTeamChain finds the owner', () => {
    const err = new BillingError({ code: 'NONE' });
    expect(walkResponderTeamChain(err)).toBe('Billing');
  });

  it('integrates with Effect.fail', async () => {
    const program = Effect.gen(function* () {
      yield* Effect.fail(new BillingError({ code: 'NONE' }));
      return 'unreachable';
    });

    const result = await Effect.runPromiseExit(program);
    expect(result._tag).toBe('Failure');
  });
});
