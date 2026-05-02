import { describe, expect, it } from 'bun:test';
import { currentOwner } from '@strays/runtime/currentOwner';
import { ownerMiddleware } from './ownerMiddleware.ts';

describe('hono ownerMiddleware shape', () => {
  it('extracts `next` from the (c, next) positional args and runs it under the owner scope', async () => {
    let observed: string | undefined;
    await ownerMiddleware('Billing')({}, async () => {
      observed = currentOwner();
    });
    expect(observed).toBe('Billing');
  });
});
