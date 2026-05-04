import { describe, expect, it } from 'bun:test';
import { currentOwner } from '@strays/core/scope/currentOwner';
import { ownerMiddleware } from './ownerMiddleware.ts';

describe('express ownerMiddleware shape', () => {
  it('extracts `next` from the (req, res, next) positional args and runs it under the owner scope', () => {
    let observed: string | undefined;
    const result = ownerMiddleware('Billing')({}, {}, () => {
      observed = currentOwner();
    });
    expect(observed).toBe('Billing');
    expect(result).toBeUndefined();
  });
});
