import { resolveOwnerWithSource } from '@strays/core/ownership';
import { resolveTagOptions, type TagOptions } from '@strays/core/tracing/resolveTagOptions';

export interface DatadogSpan {
  setTag(key: string, value: string): void;
}

export interface DatadogTracer {
  startSpan(name: string, options?: unknown): DatadogSpan;
}

export type InstallOptions = TagOptions;

export function installDatadog(tracer: DatadogTracer, options: InstallOptions = {}): void {
  const { fallback, tagKey, sourceTagKey, emitSource } = resolveTagOptions(options);

  const original = tracer.startSpan.bind(tracer);
  tracer.startSpan = (name: string, opts?: unknown) => {
    const span = original(name, opts);
    const { owner, source } = resolveOwnerWithSource({ fallback });
    span.setTag(tagKey, owner);
    if (emitSource) span.setTag(sourceTagKey, source);
    return span;
  };
}
