import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { OWNER_TAG } from '@strays/core/symbols';
import { walkOwnedErrorChain } from '@strays/runtime/walkOwnedErrorChain';
import { TaggedOwnedError } from './TaggedOwnedError.ts';

class BillingError extends TaggedOwnedError('BillingError', 'Billing') {}

describe('TaggedOwnedError', () => {
  it('attaches the owner via Symbol.for tag', () => {
    const err = new BillingError({ code: 'CARD_DECLINED' });
    expect((err as unknown as { [OWNER_TAG]: string })[OWNER_TAG]).toBe('Billing');
  });

  it('preserves the Effect tagged-error _tag discriminant', () => {
    const err = new BillingError({ code: 'CARD_DECLINED' });
    expect((err as unknown as { _tag: string })._tag).toBe('BillingError');
  });

  it('walkOwnedErrorChain detects the owner', () => {
    const err = new BillingError({});
    expect(walkOwnedErrorChain(err)).toBe('Billing');
  });

  it('integrates with Effect.fail', async () => {
    const program = Effect.gen(function* () {
      yield* Effect.fail(new BillingError({}));
      return 'unreachable';
    });

    const result = await Effect.runPromiseExit(program);
    expect(result._tag).toBe('Failure');
  });
});
