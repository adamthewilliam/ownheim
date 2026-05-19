import type { ManifestRegistry } from '../manifest/ManifestRegistry.ts';
import { resolveOwnership } from '../ownership.ts';

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
      const { ownership } = resolveOwnership({
        ...(normalisedOwner === undefined ? {} : { moduleOwner: normalisedOwner }),
        ...(options.registry === undefined ? {} : { registry: options.registry }),
        fallbackCodeTeam,
      });
      if (ownership.entrypointTeam !== undefined) span.setAttribute('strays.entrypoint_team', ownership.entrypointTeam);
      if (ownership.codeTeam !== undefined) span.setAttribute('strays.code_team', ownership.codeTeam);
      if (ownership.responderTeam !== undefined) span.setAttribute('strays.responder_team', ownership.responderTeam);
      return span;
    },
  };
}
