import { describe, expect, it } from 'bun:test';
import { Effect, Logger as EffectLogger } from 'effect';
import { OwnedError } from '@ownheim/core/OwnedError';
import type { FormattedLogLine, LogLevel } from '@ownheim/core/logging/formatOwnedLogEntry';
import { makeOwnershipLogger, type OwnershipLogSink } from './Logger.ts';

function makeMemorySink(): { readonly sink: OwnershipLogSink; readonly lines: readonly FormattedLogLine[] } {
  const lines: FormattedLogLine[] = [];
  return {
    sink: {
      write: (line: FormattedLogLine, _level: LogLevel) => {
        lines.push(line);
      },
    },
    lines,
  };
}

const provideTestLogger = (sink: OwnershipLogSink) =>
  EffectLogger.replace(EffectLogger.defaultLogger, makeOwnershipLogger(sink));

describe('ownership Logger (wiring)', () => {
  it("annotateLogs('team', 'Foo') propagates into the line's team field", async () => {
    const { sink, lines } = makeMemorySink();
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* Effect.logInfo('hello');
      }).pipe(
        Effect.annotateLogs('team', 'Foo'),
        Effect.provide(provideTestLogger(sink)),
      ),
    );

    expect(lines).toHaveLength(1);
    expect(lines[0]?.team).toBe('Foo');
    expect(lines[0]?.record.team).toBe('Foo');
  });

  it('a failing Effect with OwnedError sets team to the OwnedError owner', async () => {
    const { sink, lines } = makeMemorySink();
    await Effect.runPromise(
      Effect.fail(new OwnedError('boom', { responderTeam: 'Identity' })).pipe(
        Effect.tapErrorCause((cause) => Effect.logError('failed', cause)),
        Effect.catchAll(() => Effect.void),
        Effect.annotateLogs('team', 'Platform'),
        Effect.provide(provideTestLogger(sink)),
      ),
    );

    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]?.team).toBe('Identity');
  });

  it('logLevel.label round-trips into record.level', async () => {
    const { sink, lines } = makeMemorySink();
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* Effect.logWarning('careful');
      }).pipe(Effect.provide(provideTestLogger(sink))),
    );

    expect(lines).toHaveLength(1);
    expect(lines[0]?.record.level).toBe('warn');
    expect(lines[0]?.record.msg).toBe('careful');
  });
});
