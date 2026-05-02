import type { FormattedLogLine, LogLevel } from '@strays/runtime/formatOwnedLogEntry';
import type { LogSink } from '@strays/runtime/LogSink';
import { resetDefaultLogSink, setDefaultLogSink } from '@strays/runtime/defaultLogSink';

// Re-shape: a captured log entry pairs the formatter output with the level
// the logger emitted it at. Wave 2 contract tests assert on `.level` and
// `.team` directly, plus arbitrary fields under `.record`.
export interface CapturedLogEntry {
  readonly level: LogLevel;
  readonly line: FormattedLogLine;
}

export interface CapturedLogs {
  readonly entries: readonly CapturedLogEntry[];
  readonly clear: () => void;
  readonly restore: () => void;
}

/**
 * Installs a process-wide capturing `LogSink` via
 * `@strays/runtime/defaultLogSink`. Loggers created by `createLogger` (and
 * by the build-time-rewritten `logger` factory) without an explicit `sink`
 * option will emit into this capture buffer until `.restore()` is called.
 *
 * Tests must call `.restore()` (typically in `afterEach`) to avoid bleed
 * between specs.
 */
export function captureStructuredLogs(): CapturedLogs {
  const buffer: CapturedLogEntry[] = [];

  const sink: LogSink = {
    write: (line, level) => {
      buffer.push({ level, line });
    },
  };

  setDefaultLogSink(sink);

  return {
    get entries(): readonly CapturedLogEntry[] {
      return buffer;
    },
    clear: () => {
      buffer.length = 0;
    },
    restore: () => {
      resetDefaultLogSink();
    },
  };
}
