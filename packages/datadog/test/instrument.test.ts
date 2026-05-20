import { describe, expect, it } from 'bun:test';
import { runWithEntrypointOwner } from '@ownheim/core/ownership';
import { instrumentDatadog, type DatadogSpan, type DatadogTracer } from '../src/instrument.ts';

function makeMockTracer() {
  const spans: Array<{ name: string; tags: Record<string, string> }> = [];
  const tracer: DatadogTracer = {
    startSpan(name) {
      const tags: Record<string, string> = {};
      spans.push({ name, tags });
      const span: DatadogSpan = {
        setTag(key, value) {
          tags[key] = value;
        },
      };
      return span;
    },
  };
  return { spans, tracer };
}

describe('instrumentDatadog', () => {
  it('tags spans with entrypoint and fallback code ownership', () => {
    const { spans, tracer } = makeMockTracer();
    instrumentDatadog(tracer);

    runWithEntrypointOwner('Billing', () => {
      tracer.startSpan('http.request');
    });

    expect(spans[0]?.tags['ownheim.entrypoint_team']).toBe('Billing');
    expect(spans[0]?.tags['ownheim.code_team']).toBe('unowned');
  });

  it('uses a custom fallback code team', () => {
    const { spans, tracer } = makeMockTracer();
    instrumentDatadog(tracer, { fallbackCodeTeam: 'platform-default' });

    tracer.startSpan('background.job');

    expect(spans[0]?.tags['ownheim.code_team']).toBe('platform-default');
  });

  it('uses custom tag keys when provided', () => {
    const { spans, tracer } = makeMockTracer();
    instrumentDatadog(tracer, { tags: { entrypointTeam: 'entry', codeTeam: 'code' } });

    runWithEntrypointOwner('Identity', () => {
      tracer.startSpan('db.query');
    });

    expect(spans[0]?.tags.entry).toBe('Identity');
    expect(spans[0]?.tags.code).toBe('unowned');
  });

  it('is idempotent', () => {
    const { spans, tracer } = makeMockTracer();
    instrumentDatadog(tracer);
    instrumentDatadog(tracer);

    tracer.startSpan('background.job');

    expect(Object.keys(spans[0]!.tags).sort()).toEqual(['ownheim.code_team']);
  });
});
