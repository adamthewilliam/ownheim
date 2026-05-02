import { describe, expect, it } from 'bun:test';
import { currentOwner } from '@strays/runtime/currentOwner';
import { owned } from './owned.ts';

describe('express owned shape', () => {
  it('extracts `next` from the (req, res, next) positional args and runs it under the team scope', () => {
    let observed: string | undefined;
    const result = owned('Billing')({}, {}, () => {
      observed = currentOwner();
    });
    expect(observed).toBe('Billing');
    expect(result).toBeUndefined();
  });
});
