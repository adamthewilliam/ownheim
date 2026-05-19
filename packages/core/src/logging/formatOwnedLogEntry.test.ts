import { describe, expect, it } from 'bun:test';
import { formatOwnedLogEntry } from './formatOwnedLogEntry.ts';

describe('formatOwnedLogEntry', () => {
  it('emits layered ownership fields when provided', () => {
    const line = formatOwnedLogEntry({
      level: 'error',
      message: 'fail',
      entrypointTeam: 'Accounts',
      codeTeam: 'Billing',
      responderTeam: 'Billing',
    });

    expect(line.record.strays_entrypoint_team).toBe('Accounts');
    expect(line.record.strays_code_team).toBe('Billing');
    expect(line.record.strays_responder_team).toBe('Billing');
    expect(line.team).toBe('Billing');
  });

  it('omits unknown ownership layers', () => {
    const line = formatOwnedLogEntry({ level: 'info', message: 'hi', codeTeam: 'Platform' });

    expect(line.record.strays_entrypoint_team).toBeUndefined();
    expect(line.record.strays_code_team).toBe('Platform');
    expect(line.record.strays_responder_team).toBeUndefined();
  });

  it('record and parsed json agree', () => {
    const line = formatOwnedLogEntry({
      level: 'warn',
      message: 'msg',
      entrypointTeam: 'Accounts',
    });
    const parsed = JSON.parse(line.json) as Record<string, unknown>;

    expect(parsed.strays_entrypoint_team).toBe(line.record.strays_entrypoint_team);
  });

  it('serialises an Error to {name, message, stack}', () => {
    const err = new Error('bang');
    const line = formatOwnedLogEntry({ level: 'error', message: 'fail', error: err });
    const serialised = line.record.err as { name: string; message: string; stack?: string };

    expect(serialised.name).toBe('Error');
    expect(serialised.message).toBe('bang');
    expect(typeof serialised.stack === 'string' || serialised.stack === undefined).toBe(true);
  });

  it('serialises nested cause within an Error', () => {
    const root = new Error('root');
    const top = new Error('top', { cause: root });
    const line = formatOwnedLogEntry({ level: 'error', message: 'fail', error: top });
    const serialised = line.record.err as { cause?: { name: string; message: string } };

    expect(serialised.cause?.message).toBe('root');
  });

  it('preserves primitive errors as-is', () => {
    const line = formatOwnedLogEntry({
      level: 'error',
      message: 'fail',
      error: 'plain string error',
    });
    expect(line.record.err).toBe('plain string error');
  });

  it('omits the err field when error is undefined', () => {
    const line = formatOwnedLogEntry({ level: 'info', message: 'hi' });
    expect('err' in line.record).toBe(false);
  });

  it('passes nested fields through verbatim', () => {
    const line = formatOwnedLogEntry({
      level: 'info',
      message: 'hi',
      fields: { userId: 42, nested: { a: 1, b: [2, 3] } },
    });
    expect(line.record.userId).toBe(42);
    expect(line.record.nested).toEqual({ a: 1, b: [2, 3] });
  });
});
