import { describe, expect, it } from 'bun:test';
import { createTracer, type SpanFactory, type TracedSpan } from './createTracer.ts';
import { runWithOwner } from '../ownership.ts';

function makeRecordingFactory() {
  const spans: Array<{ name: string; attributes: Record<string, unknown> }> = [];
  const factory: SpanFactory = {
    start(name) {
      const span: { name: string; attributes: Record<string, unknown> } = {
        name,
        attributes: {},
      };
      spans.push(span);
      const traced: TracedSpan = {
        setAttribute(key, value) {
          span.attributes[key] = value;
        },
        end() {},
      };
      return traced;
    },
  };
  return { spans, factory };
}

describe('createTracer', () => {
  it('tags the span with the module owner when no scope is set', () => {
    const { spans, factory } = makeRecordingFactory();
    const tracer = createTracer('Billing', { factory });

    tracer.startSpan('db.query');

    expect(spans[0]?.attributes.team).toBe('Billing');
  });

  it('prefers scope owner over module owner', () => {
    const { spans, factory } = makeRecordingFactory();
    const tracer = createTracer('Billing', { factory });

    runWithOwner('Platform', () => {
      tracer.startSpan('http.request');
    });

    expect(spans[0]?.attributes.team).toBe('Platform');
  });

  it('falls back to "unowned" when no module owner and no scope', () => {
    const { spans, factory } = makeRecordingFactory();
    const tracer = createTracer('', { factory, fallback: 'unowned' });

    tracer.startSpan('orphan');

    expect(spans[0]?.attributes.team).toBe('unowned');
  });
});
