import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { withOwnershipSpan } from '../src/Tracer.ts';

describe('ownership tracing helpers', () => {
  it('wraps the Effect and preserves the result', async () => {
    const result = await Effect.runPromise(
      Effect.succeed('ok').pipe(withOwnershipSpan('billing.charge', { moduleOwner: 'Billing' })),
    );

    expect(result).toBe('ok');
  });
});
