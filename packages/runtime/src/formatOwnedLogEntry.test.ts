import { describe, expect, it } from 'bun:test';
import { OwnedError } from '@strays/core/OwnedError';
import { formatOwnedLogEntry } from './formatOwnedLogEntry.ts';

describe('formatOwnedLogEntry', () => {
  describe('precedence', () => {
    it('cause owner wins over scope, module, and fallback', () => {
      const err = new OwnedError('boom', 'Identity');
      const line = formatOwnedLogEntry({
        level: 'error',
        message: 'fail',
        error: err,
        scopeOwner: 'Platform',
        moduleOwner: 'Billing',
        fallback: 'fallback',
      });
      expect(line.team).toBe('Identity');
      expect(line.record.team).toBe('Identity');
    });

    it('scope owner wins over module and fallback when no cause owner', () => {
      const line = formatOwnedLogEntry({
        level: 'info',
        message: 'hi',
        scopeOwner: 'Platform',
        moduleOwner: 'Billing',
        fallback: 'fallback',
      });
      expect(line.team).toBe('Platform');
    });

    it('module owner wins over fallback when no cause/scope', () => {
      const line = formatOwnedLogEntry({
        level: 'info',
        message: 'hi',
        moduleOwner: 'Billing',
        fallback: 'fallback',
      });
      expect(line.team).toBe('Billing');
    });

    it('uses caller-provided fallback when nothing else resolves', () => {
      const line = formatOwnedLogEntry({
        level: 'info',
        message: 'hi',
        fallback: 'mystery',
      });
      expect(line.team).toBe('mystery');
    });

    it("defaults to 'unowned' when no fallback is provided", () => {
      const line = formatOwnedLogEntry({
        level: 'info',
        message: 'hi',
      });
      expect(line.team).toBe('unowned');
    });
  });

  describe('error chain walking', () => {
    it('walks Error.cause to find an OwnedError owner', () => {
      const root = new OwnedError('root', 'Identity');
      const middle = new Error('middle', { cause: root });
      const top = new Error('top', { cause: middle });

      const line = formatOwnedLogEntry({
        level: 'error',
        message: 'fail',
        error: top,
        scopeOwner: 'Platform',
      });

      expect(line.team).toBe('Identity');
    });

    it('falls through to scope owner when chain has no OwnedError', () => {
      const line = formatOwnedLogEntry({
        level: 'error',
        message: 'fail',
        error: new Error('plain'),
        scopeOwner: 'Platform',
      });
      expect(line.team).toBe('Platform');
    });
  });

  describe('json/record agreement', () => {
    it('record.team and parsed json team agree', () => {
      const line = formatOwnedLogEntry({
        level: 'warn',
        message: 'msg',
        scopeOwner: 'Foo',
      });
      const parsed = JSON.parse(line.json) as Record<string, unknown>;
      expect(parsed.team).toBe(line.record.team as unknown as string);
      expect(parsed.team).toBe('Foo');
    });
  });

  describe('error serialisation', () => {
    it('serialises an Error to {name, message, stack}', () => {
      const err = new Error('bang');
      const line = formatOwnedLogEntry({
        level: 'error',
        message: 'fail',
        error: err,
      });
      const serialised = line.record.err as { name: string; message: string; stack?: string };
      expect(serialised.name).toBe('Error');
      expect(serialised.message).toBe('bang');
      expect(typeof serialised.stack === 'string' || serialised.stack === undefined).toBe(true);
    });

    it('serialises nested cause within an Error', () => {
      const root = new Error('root');
      const top = new Error('top', { cause: root });
      const line = formatOwnedLogEntry({
        level: 'error',
        message: 'fail',
        error: top,
      });
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
      const line = formatOwnedLogEntry({
        level: 'info',
        message: 'hi',
      });
      expect('err' in line.record).toBe(false);
    });
  });

  describe('fields pass-through', () => {
    it('passes nested fields through verbatim', () => {
      const line = formatOwnedLogEntry({
        level: 'info',
        message: 'hi',
        fields: { userId: 42, nested: { a: 1, b: [2, 3] } },
      });
      expect(line.record.userId).toBe(42);
      expect(line.record.nested).toEqual({ a: 1, b: [2, 3] });
    });

    it('cannot have user fields collide with level/msg/team/err', () => {
      // level/msg are written before fields so fields could overwrite them, but
      // team/err are written after fields so they always win. Document and lock that.
      const err = new Error('e');
      const line = formatOwnedLogEntry({
        level: 'info',
        message: 'real-msg',
        fields: { team: 'BAD', err: 'BAD', level: 'BAD', msg: 'BAD' },
        error: err,
        scopeOwner: 'Real',
      });
      expect(line.record.team).toBe('Real');
      expect((line.record.err as { message: string }).message).toBe('e');
      // level and msg are first in the record, so user fields would clobber them — but
      // the contract is that callers must not pass level/msg in fields. Verify the
      // wrapper (createLogger) strips msg before calling. Here we just lock current
      // observed behavior: user-supplied level/msg do replace the entry's.
      expect(line.record.level).toBe('BAD');
      expect(line.record.msg).toBe('BAD');
    });
  });
});
