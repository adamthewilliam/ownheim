import { describe, expect, it } from 'bun:test';
import { currentOwner } from '@strays/runtime/currentOwner';
import { teamMiddleware } from './teamMiddleware.ts';

describe('orpc teamMiddleware shape', () => {
  it('extracts `next` from the opts object and runs it under the team scope', async () => {
    let observed: string | undefined;
    await teamMiddleware('Billing')({
      next: async () => {
        observed = currentOwner();
      },
    });
    expect(observed).toBe('Billing');
  });
});
