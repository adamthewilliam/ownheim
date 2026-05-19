import { OwnedError } from '@ownheim/core';

export async function chargeCustomer(amount: number) {
  if (amount <= 0) {
    throw new OwnedError('charge amount must be positive', { responderTeam: 'Billing' });
  }

  return { id: crypto.randomUUID(), amount, status: 'paid' as const };
}
