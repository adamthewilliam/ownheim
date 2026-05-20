import { OwnedError } from '@ownheim/core/OwnedError';

export async function createInvoice(input: { customerId: string; amount: number }) {
  if (input.amount <= 0) {
    throw new OwnedError('invoice amount must be positive', { responderTeam: 'Billing' });
  }

  return { invoiceId: 'inv_123', ...input };
}
