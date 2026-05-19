import { describe, expect, it } from 'bun:test';
import { createLogger } from './createLogger.ts';
import { makeMemorySink } from './LogSink.ts';
import { ManifestRegistry } from '../manifest/ManifestRegistry.ts';
import { runWithEntrypointOwner } from '../ownership.ts';


describe('createLogger (wiring)', () => {
  it('emits entrypoint and code ownership', () => {
    const { sink, lines } = makeMemorySink();
    const logger = createLogger('Billing', { sink });

    runWithEntrypointOwner('Accounts', () => {
      logger.info({ msg: 'in scope' });
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]?.record.strays_entrypoint_team).toBe('Accounts');
    expect(lines[0]?.record.strays_code_team).toBe('Billing');
  });

  it('forwards moduleOwner as code ownership when no entrypoint is set', () => {
    const { sink, lines } = makeMemorySink();
    const logger = createLogger('Billing', { sink });

    logger.info({ msg: 'no-scope' });

    expect(lines[0]?.record.strays_code_team).toBe('Billing');
    expect(lines[0]?.record.msg).toBe('no-scope');
    expect(lines[0]?.record.level).toBe('info');
  });

  it('uses the provided registry for stack-frame code ownership lookup', () => {
    const { sink, lines } = makeMemorySink();
    const registry = ManifestRegistry.fromManifest({
      version: 1,
      files: { [import.meta.path]: 'Frames' },
    });
    const logger = createLogger('', { sink, registry });

    logger.info({ msg: 'from-frame' });

    expect(lines[0]?.record.strays_code_team).toBe('Frames');
  });

  it('calls sink.write once per call with the correct level', () => {
    const calls: Array<{ level: string; codeTeam: unknown }> = [];
    const sink = {
      write: (line: { record: Record<string, unknown> }, level: string) => {
        calls.push({ level, codeTeam: line.record.strays_code_team });
      },
    };
    const logger = createLogger('Billing', { sink });

    logger.info({ msg: 'i' });
    logger.warn({ msg: 'w' });
    logger.error({ msg: 'e' }, new Error('boom'));

    expect(calls).toEqual([
      { level: 'info', codeTeam: 'Billing' },
      { level: 'warn', codeTeam: 'Billing' },
      { level: 'error', codeTeam: 'Billing' },
    ]);
  });
});
