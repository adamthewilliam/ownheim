import { stdoutJsonSink, type LogSink } from './LogSink.ts';

// Process-wide default sink consulted by `createLogger` when the caller does
// not pass an explicit `sink` option. The factory-rewriter (see
// `@ownheim/build/esbuildPlugin`) emits `createLogger("Owner")` with no
// options, so tests need a single seam to capture those emissions without
// monkey-patching every call site.
//
// Test-only: production code should never call `setDefaultLogSink`. The
// fallback is `stdoutJsonSink`, which preserves the historical default.
let current: LogSink = stdoutJsonSink;

export function getDefaultLogSink(): LogSink {
  return current;
}

export function setDefaultLogSink(sink: LogSink): void {
  current = sink;
}

export function resetDefaultLogSink(): void {
  current = stdoutJsonSink;
}
