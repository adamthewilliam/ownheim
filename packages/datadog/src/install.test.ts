import { describe, expect, it } from 'bun:test';
import { runWithOwner } from '@strays/core/ownership';
import { installDatadog, type DatadogSpan, type DatadogTracer } from './install.ts';

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

describe('installDatadog', () => {
  it('tags every span with the current owner from scope', () => {
    const { spans, tracer } = makeMockTracer();
    installDatadog(tracer);

    runWithOwner('Billing', () => {
      tracer.startSpan('http.request');
    });

    expect(spans[0]?.tags.team).toBe('Billing');
  });

  it('tags with the fallback when no scope is active', () => {
    const { spans, tracer } = makeMockTracer();
    installDatadog(tracer, { fallback: 'platform-default' });

    tracer.startSpan('background.job');

    expect(spans[0]?.tags.team).toBe('platform-default');
  });

  it('uses a custom tag key when provided', () => {
    const { spans, tracer } = makeMockTracer();
    installDatadog(tracer, { tagKey: 'dd.team' });

    runWithOwner('Identity', () => {
      tracer.startSpan('db.query');
    });

    expect(spans[0]?.tags['dd.team']).toBe('Identity');
  });

  it('omits team_source by default to keep cardinality minimal', () => {
    const { spans, tracer } = makeMockTracer();
    installDatadog(tracer);

    runWithOwner('Billing', () => {
      tracer.startSpan('http.request');
    });

    expect(spans[0]?.tags.team).toBe('Billing');
    expect(spans[0]?.tags.team_source).toBeUndefined();
  });

  it('emits team_source when emitSource is opted in (source: scope)', () => {
    const { spans, tracer } = makeMockTracer();
    installDatadog(tracer, { emitSource: true });

    runWithOwner('Billing', () => {
      tracer.startSpan('http.request');
    });

    expect(spans[0]?.tags.team).toBe('Billing');
    expect(spans[0]?.tags.team_source).toBe('scope');
  });

  it('emits team_source as "fallback" when opted in and no scope is active', () => {
    const { spans, tracer } = makeMockTracer();
    installDatadog(tracer, { emitSource: true, fallback: 'platform-default' });

    tracer.startSpan('background.job');

    expect(spans[0]?.tags.team).toBe('platform-default');
    expect(spans[0]?.tags.team_source).toBe('fallback');
  });

  it('honours a custom sourceTagKey when emitSource is opted in', () => {
    const { spans, tracer } = makeMockTracer();
    installDatadog(tracer, { emitSource: true, sourceTagKey: 'dd.team_source' });

    runWithOwner('Billing', () => {
      tracer.startSpan('http.request');
    });

    expect(spans[0]?.tags['dd.team_source']).toBe('scope');
  });
});
