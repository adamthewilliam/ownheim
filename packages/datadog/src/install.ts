import { resolveOwnership } from '@ownheim/core/ownership';
import { resolveTagOptions, type TagOptions } from '@ownheim/core/tracing/resolveTagOptions';

export interface DatadogSpan {
  setTag(key: string, value: string): void;
}

export interface DatadogTracer {
  startSpan(name: string, options?: unknown): DatadogSpan;
}

export type InstrumentOptions = TagOptions;

const INSTRUMENTED = Symbol.for('ownheim.datadog.instrumented');

type InstrumentedDatadogTracer = DatadogTracer & { [INSTRUMENTED]?: true };

export function instrumentDatadog(tracer: DatadogTracer, options: InstrumentOptions = {}): void {
  const instrumentedTracer = tracer as InstrumentedDatadogTracer;
  if (instrumentedTracer[INSTRUMENTED]) return;
  instrumentedTracer[INSTRUMENTED] = true;

  const { fallbackCodeTeam, tags } = resolveTagOptions(options);

  const original = tracer.startSpan.bind(tracer);
  tracer.startSpan = (name: string, opts?: unknown) => {
    const span = original(name, opts);
    const { ownership } = resolveOwnership({ fallbackCodeTeam });
    if (ownership.entrypointTeam !== undefined) span.setTag(tags.entrypointTeam, ownership.entrypointTeam);
    if (ownership.codeTeam !== undefined) span.setTag(tags.codeTeam, ownership.codeTeam);
    if (ownership.responderTeam !== undefined) span.setTag(tags.responderTeam, ownership.responderTeam);
    return span;
  };
}
