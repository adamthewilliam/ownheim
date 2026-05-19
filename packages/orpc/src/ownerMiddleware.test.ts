import { describe, expect, it } from 'bun:test';
import { currentEntrypointOwner } from '@strays/core/ownership';
import { entrypointOwner } from './ownerMiddleware.ts';

describe('orpc entrypointOwner shape', () => {
  it('extracts `next` from the opts object and runs it under the owner scope', async () => {
    let observed: string | undefined;
    await entrypointOwner('Billing')({
      next: async () => {
        observed = currentEntrypointOwner();
      },
    });
    expect(observed).toBe('Billing');
  });
});
