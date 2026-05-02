import { resolveOwner } from '@strays/runtime/resolveOwner';

export interface DatadogSpan {
  setTag(key: string, value: string): void;
}

export interface DatadogTracer {
  startSpan(name: string, options?: unknown): DatadogSpan;
}

export interface InstallOptions {
  readonly fallback?: string;
  readonly tagKey?: string;
}

export function installDatadog(tracer: DatadogTracer, options: InstallOptions = {}): void {
  const fallback = options.fallback ?? 'unowned';
  const tagKey = options.tagKey ?? 'team';

  const original = tracer.startSpan.bind(tracer);
  tracer.startSpan = (name: string, opts?: unknown) => {
    const span = original(name, opts);
    span.setTag(tagKey, resolveOwner({ fallback }));
    return span;
  };
}
