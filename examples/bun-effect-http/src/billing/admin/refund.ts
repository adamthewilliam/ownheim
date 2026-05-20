import { Effect } from 'effect';
import { withOwnershipLogAnnotations, withOwnershipSpan } from '@ownheim/effect';

export const adminRefund = (amount: number): Effect.Effect<number> =>
  Effect.gen(function* () {
    yield* Effect.logInfo('refunding invoice');
    return amount;
  }).pipe(
    withOwnershipLogAnnotations({ moduleOwner: 'Platform' }),
    withOwnershipSpan('billing.adminRefund', { moduleOwner: 'Platform' }),
  );
