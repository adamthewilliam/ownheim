import { describe, expect, it } from 'bun:test';
import { runWithEntrypointOwner } from '@ownheim/core/ownership';
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
  it('sets entrypoint and fallback code ownership on span start', () => {
    const processor = new OwnershipSpanProcessor();
    const { attributes, span } = makeMockSpan();

    runWithEntrypointOwner('Billing', () => processor.onStart(span, undefined));

    expect(attributes['ownheim.entrypoint_team']).toBe('Billing');
    expect(attributes['ownheim.code_team']).toBe('unowned');
  });

  it('uses fallbackCodeTeam when no code owner resolves', () => {
    const processor = new OwnershipSpanProcessor({ fallbackCodeTeam: 'platform-default' });
    const { attributes, span } = makeMockSpan();

    processor.onStart(span, undefined);

    expect(attributes['ownheim.code_team']).toBe('platform-default');
  });

  it('honours custom attribute keys', () => {
    const processor = new OwnershipSpanProcessor({
      tags: { entrypointTeam: 'otel.entrypoint_team', codeTeam: 'otel.code_team' },
    });
    const { attributes, span } = makeMockSpan();

    runWithEntrypointOwner('Identity', () => processor.onStart(span, undefined));

    expect(attributes['otel.entrypoint_team']).toBe('Identity');
    expect(attributes['otel.code_team']).toBe('unowned');
  });

  it('shutdown and forceFlush resolve immediately', async () => {
    const processor = new OwnershipSpanProcessor();
    await expect(processor.shutdown()).resolves.toBeUndefined();
    await expect(processor.forceFlush()).resolves.toBeUndefined();
  });
});
