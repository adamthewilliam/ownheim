import { trace } from '@opentelemetry/api';
import { OwnedError } from '@ownheim/core';

export async function checkout(amount: number) {
  return trace.getTracer('checkout').startActiveSpan('checkout', async (span) => {
    try {
      if (amount <= 0) {
        throw new OwnedError('checkout amount must be positive', { responderTeam: 'Billing' });
      }
      return { orderId: 'ord_123', amount };
    } finally {
      span.end();
    }
  });
}
