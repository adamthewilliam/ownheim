import { applyProjectedOwnership } from '@ownheim/core/tracing/projectOwnership';
import { type TagOptions } from '@ownheim/core/tracing/resolveTagOptions';

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
    applyProjectedOwnership(span, this.options, (target, key, value) =>
      target.setAttribute(key, value),
    );
  }

  onEnd(): void {}
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
}
