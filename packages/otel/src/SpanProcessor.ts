import { resolveOwnership } from '@ownheim/core/ownership';
import { resolveTagOptions, type TagOptions } from '@ownheim/core/tracing/resolveTagOptions';

export interface OtelSpan {
  setAttribute(key: string, value: string | number | boolean): void;
}

export interface OtelSpanProcessor {
  onStart(span: OtelSpan, parentContext: unknown): void;
  onEnd(span: OtelSpan): void;
  shutdown(): Promise<void>;
  forceFlush(): Promise<void>;
}

export type OwnershipSpanProcessorOptions = TagOptions;

export class OwnershipSpanProcessor implements OtelSpanProcessor {
  constructor(private readonly options: OwnershipSpanProcessorOptions = {}) {}

  onStart(span: OtelSpan, _parentContext?: unknown): void {
    const { fallbackCodeTeam, tags } = resolveTagOptions(this.options);
    const { ownership } = resolveOwnership({ fallbackCodeTeam });

    if (ownership.entrypointTeam !== undefined) span.setAttribute(tags.entrypointTeam, ownership.entrypointTeam);
    if (ownership.codeTeam !== undefined) span.setAttribute(tags.codeTeam, ownership.codeTeam);
    if (ownership.responderTeam !== undefined) span.setAttribute(tags.responderTeam, ownership.responderTeam);
  }

  onEnd(): void {}
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
}
