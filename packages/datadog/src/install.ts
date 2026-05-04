import { resolveOwnerWithSource } from '@strays/runtime/resolveOwnerWithSource';

export interface DatadogSpan {
  setTag(key: string, value: string): void;
}

export interface DatadogTracer {
  startSpan(name: string, options?: unknown): DatadogSpan;
}

export interface InstallOptions {
  readonly fallback?: string;
  readonly tagKey?: string;
  readonly sourceTagKey?: string;
  readonly emitSource?: boolean;
}

export function installDatadog(tracer: DatadogTracer, options: InstallOptions = {}): void {
  const fallback = options.fallback ?? 'unowned';
  const tagKey = options.tagKey ?? 'team';
  const sourceTagKey = options.sourceTagKey ?? 'team_source';
  const emitSource = options.emitSource ?? false;

  const original = tracer.startSpan.bind(tracer);
  tracer.startSpan = (name: string, opts?: unknown) => {
    const span = original(name, opts);
    const { owner, source } = resolveOwnerWithSource({ fallback });
    span.setTag(tagKey, owner);
    if (emitSource) span.setTag(sourceTagKey, source);
    return span;
  };
}
