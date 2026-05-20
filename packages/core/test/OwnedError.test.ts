import { describe, expect, it } from 'bun:test';
import { OwnedError, getResponderTeam, isOwnedError, withResponderTeam } from '../src/OwnedError.ts';
import { OWNER_TAG } from '../src/symbols.ts';

describe('OwnedError', () => {
  it('attaches responder team via Symbol.for tag', () => {
    const err = new OwnedError('boom', { responderTeam: 'Billing' });

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('OwnedError');
    expect(err[OWNER_TAG]).toBe('Billing');
    expect(err.responderTeam).toBe('Billing');
    expect(getResponderTeam(err)).toBe('Billing');
  });

  it('subclasses preserve the responder tag', () => {
    class PaymentError extends OwnedError {}
    const err = new PaymentError('declined', { responderTeam: 'Payments' });

    expect(isOwnedError(err)).toBe(true);
    expect(getResponderTeam(err)).toBe('Payments');
  });

  it('detects an OwnedError-shaped object even when not an instance', () => {
    const fauxError = { [OWNER_TAG]: 'Billing' };

    expect(isOwnedError(fauxError)).toBe(true);
    expect(getResponderTeam(fauxError)).toBe('Billing');
  });

  it('preserves Error.cause via options', () => {
    const root = new Error('root');
    const owned = new OwnedError('wrapper', { responderTeam: 'Identity', cause: root });

    expect(owned.cause).toBe(root);
  });

  it('can annotate an existing Error with a responder team', () => {
    const err = withResponderTeam(new Error('boom'), 'Platform');

    expect(isOwnedError(err)).toBe(true);
    expect(getResponderTeam(err)).toBe('Platform');
  });
});
