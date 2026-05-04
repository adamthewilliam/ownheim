import { describe, expect, it } from 'bun:test';
import { createLogger } from './createLogger.ts';
import { makeMemorySink } from './LogSink.ts';
import { runWithOwner } from '../scope/runWithOwner.ts';

describe('createLogger (wiring)', () => {
  it('passes currentOwner() as scopeOwner to the formatter', () => {
    const { sink, lines } = makeMemorySink();
    const logger = createLogger('Billing', { sink });

    runWithOwner('Platform', () => {
      logger.info({ msg: 'in scope' });
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]?.team).toBe('Platform');
  });

  it('forwards moduleOwner when no scope is set', () => {
    const { sink, lines } = makeMemorySink();
    const logger = createLogger('Billing', { sink });

    logger.info({ msg: 'no-scope' });

    expect(lines[0]?.team).toBe('Billing');
    expect(lines[0]?.record.msg).toBe('no-scope');
    expect(lines[0]?.record.level).toBe('info');
  });

  it('calls sink.write once per call with the correct level', () => {
    const calls: Array<{ level: string; team: string }> = [];
    const sink = {
      write: (line: { team: string }, level: string) => {
        calls.push({ level, team: line.team });
      },
    };
    const logger = createLogger('Billing', { sink });

    logger.info({ msg: 'i' });
    logger.warn({ msg: 'w' });
    logger.error({ msg: 'e' }, new Error('boom'));

    expect(calls).toEqual([
      { level: 'info', team: 'Billing' },
      { level: 'warn', team: 'Billing' },
      { level: 'error', team: 'Billing' },
    ]);
  });
});
