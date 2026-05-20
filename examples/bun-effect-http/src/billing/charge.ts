import { Effect, Schema } from 'effect';
import { ownedBy, withOwnershipLogAnnotations, withOwnershipSpan } from '@ownheim/effect';

export class BillingError extends Schema.TaggedError<BillingError>()(
  'BillingError',
  {
    code: Schema.String,
    message: Schema.String,
  },
) {}
ownedBy(BillingError, 'Billing');

export const chargeInvoice = (amount: number): Effect.Effect<{ ok: true; amount: number }, BillingError> =>
  Effect.gen(function* () {
    yield* Effect.logInfo('charging invoice');

    if (amount < 0) {
      return yield* Effect.fail(
        new BillingError({
          code: 'INVALID_AMOUNT',
          message: 'amount must be non-negative',
        }),
      );
    }

    return { ok: true, amount } as const;
  }).pipe(
    // Demonstrates Effect log ownership annotations.
    withOwnershipLogAnnotations({ moduleOwner: 'Billing' }),
    // Demonstrates Effect span ownership annotations.
    withOwnershipSpan('billing.chargeInvoice', { moduleOwner: 'Billing' }),
  );
