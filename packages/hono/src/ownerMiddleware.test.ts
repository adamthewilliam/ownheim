import { describe, expect, it } from 'bun:test';
import { currentEntrypointOwner } from '@ownheim/core/ownership';
import { entrypointOwner } from './ownerMiddleware.ts';

describe('hono entrypointOwner shape', () => {
  it('extracts `next` from the (c, next) positional args and runs it under the owner scope', async () => {
    let observed: string | undefined;
    await entrypointOwner('Billing')({}, async () => {
      observed = currentEntrypointOwner();
    });
    expect(observed).toBe('Billing');
  });
});
