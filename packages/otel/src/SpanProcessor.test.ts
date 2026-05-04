import { describe, expect, it } from 'bun:test';
import { runWithOwner } from '@strays/runtime/scope/runWithOwner';
import { OwnershipSpanProcessor, type OtelSpan } from './SpanProcessor.ts';

function makeMockSpan(): { attributes: Record<string, unknown>; span: OtelSpan } {
  const attributes: Record<string, unknown> = {};
  const span: OtelSpan = {
    setAttribute(key, value) {
      attributes[key] = value;
    },
  };
  return { attributes, span };
}

describe('OwnershipSpanProcessor', () => {
  it('sets team attribute on span start from current scope', () => {
    const processor = new OwnershipSpanProcessor();
    const { attributes, span } = makeMockSpan();

    runWithOwner('Billing', () => processor.onStart(span, undefined));

    expect(attributes.team).toBe('Billing');
  });

  it('uses fallback when no scope is set', () => {
    const processor = new OwnershipSpanProcessor({ fallback: 'platform-default' });
    const { attributes, span } = makeMockSpan();

    processor.onStart(span, undefined);

    expect(attributes.team).toBe('platform-default');
  });

  it('honours a custom attribute key', () => {
    const processor = new OwnershipSpanProcessor({ attributeKey: 'otel.team' });
    const { attributes, span } = makeMockSpan();

    runWithOwner('Identity', () => processor.onStart(span, undefined));

    expect(attributes['otel.team']).toBe('Identity');
  });

  it('omits team_source attribute by default to keep cardinality minimal', () => {
    const processor = new OwnershipSpanProcessor();
    const { attributes, span } = makeMockSpan();

    runWithOwner('Billing', () => processor.onStart(span, undefined));

    expect(attributes.team).toBe('Billing');
    expect(attributes.team_source).toBeUndefined();
  });

  it('emits team_source when emitSource is opted in (source: scope)', () => {
    const processor = new OwnershipSpanProcessor({ emitSource: true });
    const { attributes, span } = makeMockSpan();

    runWithOwner('Billing', () => processor.onStart(span, undefined));

    expect(attributes.team).toBe('Billing');
    expect(attributes.team_source).toBe('scope');
  });

  it('emits team_source as "fallback" when opted in and no scope is active', () => {
    const processor = new OwnershipSpanProcessor({ emitSource: true, fallback: 'platform-default' });
    const { attributes, span } = makeMockSpan();

    processor.onStart(span, undefined);

    expect(attributes.team_source).toBe('fallback');
  });

  it('honours a custom sourceAttributeKey when emitSource is opted in', () => {
    const processor = new OwnershipSpanProcessor({ emitSource: true, sourceAttributeKey: 'otel.team_source' });
    const { attributes, span } = makeMockSpan();

    runWithOwner('Identity', () => processor.onStart(span, undefined));

    expect(attributes['otel.team_source']).toBe('scope');
  });

  it('shutdown and forceFlush resolve immediately', async () => {
    const processor = new OwnershipSpanProcessor();
    await expect(processor.shutdown()).resolves.toBeUndefined();
    await expect(processor.forceFlush()).resolves.toBeUndefined();
  });
});
