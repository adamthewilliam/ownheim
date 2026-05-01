import { describe, expect, it } from 'bun:test';
import { OwnedError } from '@strays/core/OwnedError';
import { createLogger, type LogSink } from './createLogger.ts';
import { runWithOwner } from './runWithOwner.ts';

function makeRecordingSink() {
  const records: Array<Record<string, unknown>> = [];
  const sink: LogSink = {
    info: (record) => records.push({ level: 'info', ...record }),
    warn: (record) => records.push({ level: 'warn', ...record }),
    error: (record) => records.push({ level: 'error', ...record }),
  };
  return { records, sink };
}

describe('createLogger', () => {
  it('uses the module owner when no scope is set', () => {
    const { records, sink } = makeRecordingSink();
    const logger = createLogger('Billing', { sink });

    logger.info({ msg: 'hello' });

    expect(records).toEqual([{ level: 'info', msg: 'hello', team: 'Billing' }]);
  });

  it('prefers AsyncLocalStorage scope over module owner', () => {
    const { records, sink } = makeRecordingSink();
    const logger = createLogger('Billing', { sink });

    runWithOwner('Platform', () => {
      logger.info({ msg: 'in scope' });
    });

    expect(records[0]?.team).toBe('Platform');
  });

  it('error-level prefers OwnedError owner over both scope and module', () => {
    const { records, sink } = makeRecordingSink();
    const logger = createLogger('Billing', { sink });
    const err = new OwnedError('failed', 'Identity');

    runWithOwner('Platform', () => {
      logger.error({ msg: 'fail' }, err);
    });

    expect(records[0]?.team).toBe('Identity');
    expect(records[0]?.err).toBe(err);
  });

  it('error-level falls back to scope when err is not an OwnedError', () => {
    const { records, sink } = makeRecordingSink();
    const logger = createLogger('Billing', { sink });

    runWithOwner('Platform', () => {
      logger.error({ msg: 'fail' }, new Error('plain'));
    });

    expect(records[0]?.team).toBe('Platform');
  });

  it('falls back to "unowned" when nothing resolves and no module owner is provided', () => {
    const { records, sink } = makeRecordingSink();
    const logger = createLogger('', { sink, fallback: 'unowned' });

    logger.info({ msg: 'orphan' });

    expect(records[0]?.team).toBe('unowned');
  });
});
