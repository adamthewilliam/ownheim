import { describe, expect, it } from 'bun:test';
import { OwnedError } from '../OwnedError.ts';
import { walkResponderTeamChain } from './walkOwnedErrorChain.ts';

describe('walkResponderTeamChain', () => {
  it('returns undefined for unowned values', () => {
    expect(walkResponderTeamChain(new Error('plain'))).toBeUndefined();
    expect(walkResponderTeamChain('string')).toBeUndefined();
    expect(walkResponderTeamChain(null)).toBeUndefined();
  });

  it('finds responder team on an OwnedError', () => {
    const err = new OwnedError('boom', { responderTeam: 'Billing' });
    expect(walkResponderTeamChain(err)).toBe('Billing');
  });

  it('walks Error.cause chains', () => {
    const root = new OwnedError('root', { responderTeam: 'Identity' });
    const top = new Error('top', { cause: root });

    expect(walkResponderTeamChain(top)).toBe('Identity');
  });

  it('returns the first responder in the chain', () => {
    const inner = new OwnedError('inner', { responderTeam: 'Billing' });
    const outer = new OwnedError('outer', { responderTeam: 'Platform', cause: inner });

    expect(walkResponderTeamChain(outer)).toBe('Platform');
  });

  it('does not hang on cyclic cause chains', () => {
    const a: Error & { cause?: unknown } = new Error('a');
    const b: Error & { cause?: unknown } = new Error('b');
    a.cause = b;
    b.cause = a;

    expect(walkResponderTeamChain(a)).toBeUndefined();
  });
});
