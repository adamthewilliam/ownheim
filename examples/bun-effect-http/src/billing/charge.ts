import { OwnedError } from '@ownheim/core/OwnedError';

export class BillingError extends OwnedError {
  constructor(message: string, public code: string) {
    super(message, 'Billing');
  }
}

export function chargeInvoice(amount: number): { ok: true; amount: number } {
  if (amount < 0) throw new BillingError('amount must be non-negative', 'INVALID_AMOUNT');
  return { ok: true, amount };
}
