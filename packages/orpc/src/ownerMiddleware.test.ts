import { describe, expect, it } from 'bun:test';
import { currentOwner } from '@strays/core/scope/currentOwner';
import { ownerMiddleware } from './ownerMiddleware.ts';

describe('orpc ownerMiddleware shape', () => {
  it('extracts `next` from the opts object and runs it under the owner scope', async () => {
    let observed: string | undefined;
    await ownerMiddleware('Billing')({
      next: async () => {
        observed = currentOwner();
      },
    });
    expect(observed).toBe('Billing');
  });
});
