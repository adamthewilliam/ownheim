import { applyOwnershipTags, resolveOwnershipTags } from '@ownheim/core/tracing/ownershipTags';
import { type TagOptions } from '@ownheim/core/tracing/resolveTagOptions';

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

  const original = tracer.startSpan.bind(tracer);
  tracer.startSpan = (name: string, opts?: unknown) => {
    const span = original(name, opts);
    applyOwnershipTags(span, resolveOwnershipTags(options), (target, key, value) =>
      target.setTag(key, value),
    );
    return span;
  };
}
