import { describe, expect, it } from 'bun:test';
import { currentOwner } from '@strays/runtime/currentOwner';
import { teamMiddleware } from './teamMiddleware.ts';

describe('hono teamMiddleware shape', () => {
  it('extracts `next` from the (c, next) positional args and runs it under the team scope', async () => {
    let observed: string | undefined;
    await teamMiddleware('Billing')({}, async () => {
      observed = currentOwner();
    });
    expect(observed).toBe('Billing');
  });
});
