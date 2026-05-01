import { describe, expect, it } from 'bun:test';
import { OwnedError, getErrorOwner, isOwnedError } from './OwnedError.ts';
import { OWNER_TAG } from './symbols.ts';

describe('OwnedError', () => {
  it('attaches owner via Symbol.for tag', () => {
    const err = new OwnedError('boom', 'Billing');
    expect(err.message).toBe('boom');
    expect(err[OWNER_TAG]).toBe('Billing');
  });

  it('subclasses preserve the owner tag', () => {
    class BillingError extends OwnedError {
      constructor(message: string, public code: string) {
        super(message, 'Billing');
      }
    }

    const err = new BillingError('charge failed', 'CARD_DECLINED');
    expect(getErrorOwner(err)).toBe('Billing');
    expect(err.code).toBe('CARD_DECLINED');
  });

  it('isOwnedError detects via Symbol.for, not instanceof', () => {
    const err = new OwnedError('x', 'Platform');
    expect(isOwnedError(err)).toBe(true);
    expect(isOwnedError(new Error('plain'))).toBe(false);
    expect(isOwnedError(null)).toBe(false);
    expect(isOwnedError(undefined)).toBe(false);
    expect(isOwnedError('string')).toBe(false);
  });

  it('detects an OwnedError-shaped object even when not an instance', () => {
    // Simulates a duplicated bundle producing structurally compatible errors.
    const fauxError = { [OWNER_TAG]: 'Billing', message: 'duplicated bundle' };
    expect(isOwnedError(fauxError)).toBe(true);
    expect(getErrorOwner(fauxError)).toBe('Billing');
  });

  it('preserves Error.cause via options', () => {
    const root = new Error('root');
    const owned = new OwnedError('wrapper', 'Identity', { cause: root });
    expect(owned.cause).toBe(root);
  });
});
