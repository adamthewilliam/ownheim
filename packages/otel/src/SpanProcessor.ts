import { resolveOwnerWithSource } from '@strays/runtime/resolution/resolveOwner';
import {
  DEFAULT_FALLBACK,
  DEFAULT_SOURCE_TAG_KEY,
  DEFAULT_TAG_KEY,
} from '@strays/runtime/tracing/resolveTagOptions';

export interface OtelSpan {
  setAttribute(key: string, value: string | number | boolean): void;
}

export interface OtelSpanProcessor {
  onStart(span: OtelSpan, parentContext: unknown): void;
  onEnd(span: OtelSpan): void;
  shutdown(): Promise<void>;
  forceFlush(): Promise<void>;
}

export interface OwnershipSpanProcessorOptions {
  readonly fallback?: string;
  readonly attributeKey?: string;
  readonly sourceAttributeKey?: string;
  readonly emitSource?: boolean;
}

export class OwnershipSpanProcessor implements OtelSpanProcessor {
  constructor(private readonly options: OwnershipSpanProcessorOptions = {}) {}

  onStart(span: OtelSpan, _parentContext?: unknown): void {
    const fallback = this.options.fallback ?? DEFAULT_FALLBACK;
    const key = this.options.attributeKey ?? DEFAULT_TAG_KEY;
    const sourceKey = this.options.sourceAttributeKey ?? DEFAULT_SOURCE_TAG_KEY;
    const emitSource = this.options.emitSource ?? false;

    const { owner, source } = resolveOwnerWithSource({ fallback });
    span.setAttribute(key, owner);
    if (emitSource) span.setAttribute(sourceKey, source);
  }

  onEnd(): void {}
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
}
