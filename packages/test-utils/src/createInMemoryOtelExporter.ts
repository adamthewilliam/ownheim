import type { RecordedSpan } from './RecordedSpan.ts';

// Structurally compatible with the subset of `@opentelemetry/sdk-trace-base`
// `SpanExporter` that contract tests need. Wave 2's otel agent will write a
// thin adapter that converts a real `ReadableSpan` to `RecordedSpan` and
// delegates here. Keeping the surface tiny avoids leaking SDK types into
// `@strays/test-utils`.
export interface InMemoryOtelExporter {
  readonly export: (spans: readonly RecordedSpan[]) => void;
  readonly shutdown: () => Promise<void>;
  readonly getFinishedSpans: () => readonly RecordedSpan[];
  readonly reset: () => void;
}

export function createInMemoryOtelExporter(): InMemoryOtelExporter {
  let buffer: RecordedSpan[] = [];
  let shutdown = false;

  return {
    export: (spans) => {
      if (shutdown) return;
      for (const span of spans) buffer.push(span);
    },
    shutdown: async () => {
      shutdown = true;
    },
    getFinishedSpans: () => buffer,
    reset: () => {
      buffer = [];
      shutdown = false;
    },
  };
}
