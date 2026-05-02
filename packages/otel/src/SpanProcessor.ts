import { resolveOwner } from '@strays/runtime/resolveOwner';

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
}

export class OwnershipSpanProcessor implements OtelSpanProcessor {
  constructor(private readonly options: OwnershipSpanProcessorOptions = {}) {}

  onStart(span: OtelSpan, _parentContext?: unknown): void {
    const fallback = this.options.fallback ?? 'unowned';
    const key = this.options.attributeKey ?? 'team';
    span.setAttribute(key, resolveOwner({ fallback }));
  }

  onEnd(): void {}
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
}
