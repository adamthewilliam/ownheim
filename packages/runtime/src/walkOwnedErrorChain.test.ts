import { describe, expect, it } from 'bun:test';
import { OwnedError } from '@strays/core/OwnedError';
import { walkOwnedErrorChain } from './walkOwnedErrorChain.ts';

describe('walkOwnedErrorChain', () => {
  it('returns undefined for plain errors', () => {
    expect(walkOwnedErrorChain(new Error('plain'))).toBeUndefined();
  });

  it('returns undefined for non-objects', () => {
    expect(walkOwnedErrorChain('string')).toBeUndefined();
    expect(walkOwnedErrorChain(42)).toBeUndefined();
    expect(walkOwnedErrorChain(null)).toBeUndefined();
    expect(walkOwnedErrorChain(undefined)).toBeUndefined();
  });

  it('finds owner on a top-level OwnedError', () => {
    const err = new OwnedError('boom', 'Billing');
    expect(walkOwnedErrorChain(err)).toBe('Billing');
  });

  it('walks Error.cause chain to find the first OwnedError', () => {
    const root = new OwnedError('root cause', 'Identity');
    const middle = new Error('middle', { cause: root });
    const top = new Error('top', { cause: middle });

    expect(walkOwnedErrorChain(top)).toBe('Identity');
  });

  it('returns the first OwnedError in the chain when multiple exist', () => {
    const inner = new OwnedError('inner', 'Platform');
    const outer = new OwnedError('outer', 'Billing', { cause: inner });

    expect(walkOwnedErrorChain(outer)).toBe('Billing');
  });

  it('handles cyclic cause chains without infinite looping', () => {
    const a = new Error('a') as Error & { cause?: unknown };
    const b = new Error('b', { cause: a }) as Error & { cause?: unknown };
    a.cause = b;

    expect(walkOwnedErrorChain(a)).toBeUndefined();
  });
});
