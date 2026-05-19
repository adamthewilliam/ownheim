// Integration test for `@ownheim/datadog` against the real `dd-trace`
// package. We want to prove three things end-to-end:
//
//   1. After `instrumentDatadog(tracer)`, every `tracer.startSpan` call
//      attaches a `team` tag derived from `runWithEntrypointOwner` scope.
//   2. The patch survives across both import orders (ownheim first vs.
//      dd-trace first), and we document any constraint we find.
//   3. AsyncLocalStorage propagation works across an async hop.
//
// Strategy: we use `dd-trace` for real but point it at an unreachable
// agent URL so background flushes silently fail. We never assert on
// anything network-dependent; we read tags directly off the span via
// `span.context()._tags`, which is where `setTag` writes them
// synchronously inside the OpenTracing-compatible Span implementation
// (see node_modules/dd-trace/packages/dd-trace/src/opentracing/span.js).
//
// Two Bun caveats need workarounds before dd-trace will run inside
// `bun test`:
//
//   1. Module._compile shim. dd-trace's auto-instrumentation calls
//      `shimmer.wrap(Module.prototype, '_compile', …)`. Bun does not
//      expose `Module.prototype._compile`, so the shimmer throws
//      `TypeError: No original method _compile`. We install a no-op
//      `_compile` BEFORE importing dd-trace.
//
//   2. Jest-worker detection. dd-trace's entry point uses
//      `typeof jest !== 'undefined'` to detect Jest workers and
//      falls back to a `NoopProxy` (its `setTag` is a no-op, tags are
//      empty). Bun's test runner injects a `jest` global into every
//      CJS module evaluation for Jest-compat. Since `jest` is a
//      module-scope local — not a property of `globalThis` — we can't
//      hide it from user-space. Instead we pre-populate
//      `require.cache` so that `require('dd-trace/.../src/index')`
//      short-circuits to the real `proxy.js` and never sees the
//      `inJestWorker` branch.
//
// Both workarounds are test-environment-only and never ship to
// production.

import { Module, createRequire } from 'node:module';

// Workaround #1: shim Module.prototype._compile for Bun.
function noopCompile(): undefined {
  return undefined;
}
const ModuleProto = Module.prototype as unknown as { _compile?: unknown };
if (typeof ModuleProto._compile !== 'function') {
  (ModuleProto as { _compile: () => undefined })._compile = noopCompile;
}

// Point dd-trace at an unreachable agent so background writers fail
// silently instead of trying to talk to a real Datadog Agent. Set
// before any dd-trace require so config picks it up.
process.env.DD_TRACE_AGENT_URL = 'http://127.0.0.1:1';
process.env.DD_TRACE_STARTUP_LOGS = 'false';
process.env.DD_TELEMETRY_HEARTBEAT_INTERVAL = '0';
process.env.DD_REMOTE_CONFIGURATION_ENABLED = 'false';

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { runWithEntrypointOwner } from '@ownheim/core/ownership';
import { instrumentDatadog, type DatadogTracer } from '@ownheim/datadog/install';

// dd-trace's runtime types are not exported for our adapter shape, so
// we type the imported tracer through our adapter's structural
// interface plus a minimal extension for `init` and the internal
// context accessor.
interface DdTraceSpan {
  setTag(key: string, value: string): void;
  context(): { _tags: Record<string, unknown> };
  finish(): void;
}

interface DdTraceTracer extends DatadogTracer {
  init(options?: Record<string, unknown>): DdTraceTracer;
  startSpan(name: string, options?: unknown): DdTraceSpan;
}

// Read the team tag straight off the span context. This is the same
// place `setTag('team', …)` writes (see span.js#setTag → _addTags).
function teamTag(span: unknown): unknown {
  const s = span as DdTraceSpan;
  return s.context()._tags.team;
}

// Workaround #2: load dd-trace so that its src/index.js dispatch is
// replaced in `require.cache` with the real Proxy. We resolve and
// require the proxy directly, then write that into the cache slot for
// the index module. Subsequent `require('dd-trace')` returns a tracer
// backed by the real Proxy regardless of the Jest-worker check.
function loadRealDdTrace(): DdTraceTracer {
  const cjsRequire = createRequire(import.meta.url);
  const indexPath = cjsRequire.resolve('dd-trace/packages/dd-trace/src/index');
  const proxyPath = cjsRequire.resolve('dd-trace/packages/dd-trace/src/proxy');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RealProxy = cjsRequire(proxyPath);
  const cache = cjsRequire.cache as Record<string, NodeJS.Module>;
  cache[indexPath] = {
    exports: RealProxy,
    loaded: true,
    id: indexPath,
    filename: indexPath,
    paths: [],
    children: [],
    // The Module type wants a require() — Bun's createRequire result
    // is callable. Cast through unknown to keep TS quiet.
  } as unknown as NodeJS.Module;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return cjsRequire('dd-trace') as DdTraceTracer;
}

describe('@ownheim/datadog + real dd-trace (import order: ownheim-first)', () => {
  let tracer: DdTraceTracer;

  beforeAll(() => {
    // The ownheim modules are already imported above. Now bring dd-trace
    // in via our cache-trick loader and initialize it, then install our
    // patch on top.
    tracer = loadRealDdTrace();
    tracer.init({
      service: 'ownheim-datadog-integration-test',
      plugins: false,
      logInjection: false,
    });
    instrumentDatadog(tracer as unknown as DatadogTracer);
  });

  it('tags spans with the active runWithEntrypointOwner scope', () => {
    let span: DdTraceSpan | undefined;
    runWithEntrypointOwner('Billing', () => {
      span = tracer.startSpan('http.request');
    });
    expect(span).toBeDefined();
    expect(teamTag(span)).toBe('Billing');
    span?.finish();
  });

  it('propagates the owner across an async hop', async () => {
    let span: DdTraceSpan | undefined;
    await runWithEntrypointOwner('Billing', async () => {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
      span = tracer.startSpan('async.work');
    });
    expect(teamTag(span)).toBe('Billing');
    span?.finish();
  });

  it('tags as `unowned` outside any scope (default fallback)', () => {
    const span = tracer.startSpan('background.cron');
    // resolveOwner() falls back through manifest → 'unowned' when no
    // scope is active and no manifest entry matches the caller frame.
    expect(teamTag(span)).toBe('unowned');
    span.finish();
  });

  it('honours nested runWithEntrypointOwner — innermost wins', () => {
    let inner: DdTraceSpan | undefined;
    let outer: DdTraceSpan | undefined;
    runWithEntrypointOwner('Identity', () => {
      runWithEntrypointOwner('Billing', () => {
        inner = tracer.startSpan('inner.span');
      });
      outer = tracer.startSpan('outer.span');
    });
    expect(teamTag(inner)).toBe('Billing');
    expect(teamTag(outer)).toBe('Identity');
    inner?.finish();
    outer?.finish();
  });
});

describe('@ownheim/datadog + real dd-trace (import order: dd-trace-first)', () => {
  // dd-trace was already imported by the previous describe block (its
  // module state is process-global). To exercise the "dd-trace import
  // happened first, then we install ownheim" code path we re-resolve
  // the same tracer instance and re-apply instrumentDatadog.
  //
  // Note: the dd-trace shimmer monkey-patches Module._compile at
  // require time, before any user code can intervene. So in practice
  // the only import-order dimension that matters for users is whether
  // `instrumentDatadog` is called before or after `tracer.init()`. Both
  // work, because `instrumentDatadog` patches the proxy's `startSpan`
  // method, and the proxy is the same singleton instance whether or
  // not `init()` has been called.
  let tracer: DdTraceTracer;
  let stackedStartSpan: DdTraceTracer['startSpan'];

  beforeAll(() => {
    tracer = loadRealDdTrace();

    // The previous describe's instrumentDatadog already wrapped startSpan
    // on this singleton. Snapshot the wrapped version so we can restore
    // it after this block, then install AGAIN to model "user installs
    // ownheim after dd-trace was already initialized elsewhere".
    stackedStartSpan = tracer.startSpan.bind(tracer);
    instrumentDatadog(tracer as unknown as DatadogTracer);
  });

  afterAll(() => {
    // Restore so we don't leak this stacked wrapper into other tests.
    (tracer as unknown as { startSpan: unknown }).startSpan = stackedStartSpan;
  });

  it('still tags spans when ownheim is installed AFTER dd-trace.init', () => {
    let span: DdTraceSpan | undefined;
    runWithEntrypointOwner('Billing', () => {
      span = tracer.startSpan('http.request');
    });
    expect(teamTag(span)).toBe('Billing');
    span?.finish();
  });

  it('still propagates across an async hop in this order', async () => {
    let span: DdTraceSpan | undefined;
    await runWithEntrypointOwner('Identity', async () => {
      await Promise.resolve();
      span = tracer.startSpan('async.work');
    });
    expect(teamTag(span)).toBe('Identity');
    span?.finish();
  });
});
