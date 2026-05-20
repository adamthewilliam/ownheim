import { describe, expect, it } from 'bun:test';
import { currentEntrypointOwner } from '@ownheim/core/ownership';
import { entrypointOwner } from '../src/ownerMiddleware.ts';

describe('express entrypointOwner shape', () => {
  it('extracts `next` from the (req, res, next) positional args and runs it under the owner scope', () => {
    let observed: string | undefined;
    const result = entrypointOwner('Billing')({}, {}, () => {
      observed = currentEntrypointOwner();
    });
    expect(observed).toBe('Billing');
    expect(result).toBeUndefined();
  });
});
