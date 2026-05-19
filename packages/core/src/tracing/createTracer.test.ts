import { describe, expect, it } from 'bun:test';
import { createTracer, type SpanFactory, type TracedSpan } from './createTracer.ts';
import { runWithEntrypointOwner } from '../ownership.ts';

function makeRecordingFactory() {
  const spans: Array<{ name: string; attributes: Record<string, unknown> }> = [];
  const factory: SpanFactory = {
    start(name) {
      const span: { name: string; attributes: Record<string, unknown> } = { name, attributes: {} };
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
  it('tags the span with code ownership from the module owner', () => {
    const { spans, factory } = makeRecordingFactory();
    const tracer = createTracer('Billing', { factory });

    tracer.startSpan('db.query');

    expect(spans[0]?.attributes['strays.code_team']).toBe('Billing');
  });

  it('emits entrypoint and code ownership independently', () => {
    const { spans, factory } = makeRecordingFactory();
    const tracer = createTracer('Billing', { factory });

    runWithEntrypointOwner('Accounts', () => {
      tracer.startSpan('http.request');
    });

    expect(spans[0]?.attributes['strays.entrypoint_team']).toBe('Accounts');
    expect(spans[0]?.attributes['strays.code_team']).toBe('Billing');
  });

  it('falls back code ownership when no module owner and no scope', () => {
    const { spans, factory } = makeRecordingFactory();
    const tracer = createTracer('', { factory, fallbackCodeTeam: 'unowned' });

    tracer.startSpan('orphan');

    expect(spans[0]?.attributes['strays.code_team']).toBe('unowned');
  });
});
