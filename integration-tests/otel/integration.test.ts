import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { trace } from '@opentelemetry/api';
import {
  InMemorySpanExporter,
  NodeTracerProvider,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import { runWithOwner } from '@strays/runtime/runWithOwner';
import { OwnershipSpanProcessor } from '@strays/otel/SpanProcessor';

describe('@strays/otel integration with real SDK', () => {
  let exporter: InMemorySpanExporter;
  let provider: NodeTracerProvider;

  beforeEach(() => {
    exporter = new InMemorySpanExporter();
    provider = new NodeTracerProvider({
      spanProcessors: [new OwnershipSpanProcessor(), new SimpleSpanProcessor(exporter)],
    });
    provider.register();
  });

  afterEach(async () => {
    await provider.shutdown();
    trace.disable();
    exporter.reset();
  });

  it('tags spans with team from runWithOwner scope', async () => {
    runWithOwner('Billing', () => {
      trace.getTracer('app').startSpan('charge').end();
    });
    await provider.forceFlush();

    const finished = exporter.getFinishedSpans();
    expect(finished.length).toBe(1);
    expect(finished[0]?.attributes.team).toBe('Billing');
  });

  it('does not tag spans created outside any runWithOwner scope (uses default fallback)', async () => {
    trace.getTracer('app').startSpan('orphan').end();
    await provider.forceFlush();

    const finished = exporter.getFinishedSpans();
    expect(finished.length).toBe(1);
    expect(finished[0]?.attributes.team).toBe('unowned');
  });

  it('preserves owner across async hop within runWithOwner', async () => {
    await runWithOwner('Billing', async () => {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
      trace.getTracer('app').startSpan('async-op').end();
    });
    await provider.forceFlush();

    const finished = exporter.getFinishedSpans();
    expect(finished.length).toBe(1);
    expect(finished[0]?.attributes.team).toBe('Billing');
  });

  it('handles nested runWithOwner correctly (innermost wins)', async () => {
    runWithOwner('Billing', () => {
      runWithOwner('Identity', () => {
        trace.getTracer('app').startSpan('inner').end();
      });
      trace.getTracer('app').startSpan('outer').end();
    });
    await provider.forceFlush();

    const finished = exporter.getFinishedSpans();
    const byName = Object.fromEntries(finished.map((s) => [s.name, s.attributes.team]));
    expect(byName.inner).toBe('Identity');
    expect(byName.outer).toBe('Billing');
  });

  it('tags onStart — scope active at startSpan time wins, not at end time', async () => {
    // Start the span outside any scope, then end it inside `Billing`.
    // Because OwnershipSpanProcessor tags on `onStart`, the attribute reflects
    // the scope that was active when the span was started — i.e. the fallback.
    const span = trace.getTracer('app').startSpan('captured-before-scope');
    runWithOwner('Billing', () => {
      span.end();
    });
    await provider.forceFlush();

    const finished = exporter.getFinishedSpans();
    expect(finished.length).toBe(1);
    expect(finished[0]?.attributes.team).toBe('unowned');
  });

  it('honours a custom attribute key when configured', async () => {
    // Re-register a fresh provider with a custom-keyed processor.
    await provider.shutdown();
    trace.disable();
    exporter = new InMemorySpanExporter();
    provider = new NodeTracerProvider({
      spanProcessors: [
        new OwnershipSpanProcessor({ attributeKey: 'otel.team', fallback: 'platform' }),
        new SimpleSpanProcessor(exporter),
      ],
    });
    provider.register();

    runWithOwner('Identity', () => {
      trace.getTracer('app').startSpan('custom').end();
    });
    await provider.forceFlush();

    const finished = exporter.getFinishedSpans();
    expect(finished.length).toBe(1);
    expect(finished[0]?.attributes['otel.team']).toBe('Identity');
    expect(finished[0]?.attributes.team).toBeUndefined();
  });
});
