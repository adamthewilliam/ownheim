import type { ManifestRegistry } from '../manifest/ManifestRegistry.ts';
import { applyOwnershipTags, resolveOwnershipTags } from './ownershipTags.ts';

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
  readonly fallbackCodeTeam?: string;
  readonly registry?: ManifestRegistry;
}

export function createTracer(moduleOwner: string, options: CreateTracerOptions): Tracer {
  const fallbackCodeTeam = options.fallbackCodeTeam ?? 'unowned';
  const normalisedOwner = moduleOwner === '' ? undefined : moduleOwner;

  return {
    startSpan(name) {
      const span = options.factory.start(name);
      applyOwnershipTags(
        span,
        resolveOwnershipTags({
          ...(normalisedOwner === undefined ? {} : { moduleOwner: normalisedOwner }),
          ...(options.registry === undefined ? {} : { registry: options.registry }),
          fallbackCodeTeam,
        }),
        (target, key, value) => target.setAttribute(key, value),
      );
      return span;
    },
  };
}
