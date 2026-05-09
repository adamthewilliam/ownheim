import type { ManifestRegistry } from '../manifest/ManifestRegistry.ts';
import { resolveOwner } from '../ownership.ts';

export interface TracedSpan {
  setAttribute(key: string, value: string | number | boolean): void;
  end(): void;
}

export interface SpanFactory {
  start(name: string): TracedSpan;
}

export interface Tracer {
  startSpan(name: string): TracedSpan;
}

export interface CreateTracerOptions {
  readonly factory: SpanFactory;
  readonly fallback?: string;
  readonly registry?: ManifestRegistry;
}

export function createTracer(moduleOwner: string, options: CreateTracerOptions): Tracer {
  const fallback = options.fallback ?? 'unowned';
  const normalisedOwner = moduleOwner === '' ? undefined : moduleOwner;

  return {
    startSpan(name) {
      const span = options.factory.start(name);
      const team = resolveOwner({ moduleOwner: normalisedOwner, fallback });
      span.setAttribute('team', team);
      return span;
    },
  };
}
