# Deepening `@strays/runtime` Manifest — Design Note

## 1. Problem statement

`packages/runtime/src/manifest.ts` exposes three free functions whose behaviour is governed entirely by two module-level `let` bindings (`activeManifest`, `lookupCache`). This is a textbook *shallow* module: a thin wrapper over a hash lookup whose interface advertises power (`lookupOwner(filePath)`) but whose semantics depend on hidden temporal coupling (must call `loadManifest` first, must call `clearManifest` to reset). The mutable globals leak across every test in the same process — `manifest.test.ts` and `lookupCallerOwner.test.ts` both ship `afterEach(() => clearManifest())` ceremony, and `lookupCallerOwner` carries its *own* parallel `cache` Map that must also be reset (`clearCallerCache()`), creating two ways to silently observe stale state. Worse, `lookupOwner` returns `undefined` indistinguishably for "manifest not loaded" and "file not in manifest", so a forgotten `loadManifest()` in production looks identical to genuine miss data — there is no compile-time or run-time signal that the registry was never wired up.

## 2. Candidate interfaces

### Option A — Registry value type

Replace globals with a `ManifestRegistry` value. The registry encapsulates the manifest plus its lookup cache; nothing module-level exists.

```ts
// packages/runtime/src/ManifestRegistry.ts
export class ManifestRegistry {
  static fromManifest(manifest: OwnershipManifest): ManifestRegistry { ... }
  static empty(): ManifestRegistry { ... }
  lookupOwner(filePath: string): string | undefined { ... }
}
```

Consumers receive a registry instance:

```ts
const registry = ManifestRegistry.fromManifest(manifest);
const logger  = createLogger('Billing', { registry });
const tracer  = createTracer('Billing', { factory, registry });
resolveOwnerFromEvent(err, stacktrace, { registry });
```

Plus an *opt-in* default singleton (`getDefaultRegistry()` / `setDefaultRegistry(r)`) so existing callers that didn't thread a registry keep working — but the default is **explicit and overridable**, not implicit and global.

- **Pro**: Idiomatic OO/value-object encapsulation. Tests construct fresh registries with zero ceremony. Compile-time wiring is checkable: a call site that asks for a registry must produce one.
- **Con**: Touches every consumer's signature. Without the back-compat singleton this is a major version bump.

### Option B — Lazy provider (functional currying)

Make every consumer a *factory* that closes over the registry once and returns the actual function:

```ts
const lookupOwner          = (registry: ManifestRegistry) => (file: string) => ...
const lookupCallerOwner    = (registry: ManifestRegistry) => (skip = 1) => ...
const createLogger         = (registry: ManifestRegistry) => (owner, opts) => Logger
```

App entry wires the registry once: `const lookupOwner = makeLookupOwner(registry)`.

- **Pro**: Smallest *runtime* footprint — registry is captured once, no parameter threading per call. Pure functions, easily unit-testable.
- **Con**: API shape changes substantially (every export becomes "call with registry first"). Awkward for static helpers like `createLogger('Billing')` that are scattered across the codebase. Type ergonomics suffer.

### Option C — Implicit context via `AsyncLocalStorage`

Reuse the existing `ownerStore` mechanism. Store the manifest in a parallel `manifestStore: AsyncLocalStorage<ManifestRegistry>`. App entry enters a scope once:

```ts
withManifest(registry, () => server.start())
```

`lookupOwner(file)` reads `manifestStore.getStore()` internally.

- **Pro**: Zero changes to consumer signatures. Test isolation is automatic: each `it()` block runs inside `withManifest(testRegistry, fn)`.
- **Con**: Trades one form of hidden state (module global) for another (ALS). Forgetting `withManifest` is exactly as silent as forgetting `loadManifest`. ALS has measurable per-call overhead and breaks for code that lives outside any async chain (e.g. a top-level Sentry breadcrumb fired during boot). Conceptually wrong: the manifest is process-scoped configuration, not request-scoped data, so it doesn't fit the ALS abstraction. Most invasive of the three for the *least* clarity gain.

## 3. Recommended design — **Option A: `ManifestRegistry` value with an explicit default**

This deepens the module the most: it converts a module-level mutable into a value, gives the value a real identity (`ManifestRegistry`), and makes the *absence* of a manifest expressible at the type level via constructors (`ManifestRegistry.empty()` is a registry, just one that always misses — it is not "no registry").

### File structure inside `@strays/runtime`

```
packages/runtime/src/
  OwnershipManifest.ts          # the manifest data type only (interface)
  ManifestRegistry.ts           # class, holds manifest + cache, lookupOwner method
  defaultRegistry.ts            # getDefaultRegistry / setDefaultRegistry / resetDefaultRegistry
  manifest.ts                   # thin back-compat shim — deprecated, re-exports the old free fns implemented over the default singleton
  lookupCallerOwner.ts          # accepts an optional registry; falls back to default
  createLogger.ts               # ditto, accepts { registry } option
  createTracer.ts               # ditto
```

`OwnershipManifest` (the JSON shape) is split out from `ManifestRegistry` (the live, cache-bearing value) so the build artifact has nothing to do with runtime caching.

### Migration: before / after for each consumer

**`lookupCallerOwner`**

```ts
// before
import { lookupOwner } from './manifest.ts';
export function lookupCallerOwner(skipFrames = 1): string | undefined {
  ...
  const owner = lookupOwner(file);
  ...
}

// after
import { getDefaultRegistry } from './defaultRegistry.ts';
import type { ManifestRegistry } from './ManifestRegistry.ts';

export function lookupCallerOwner(
  skipFrames = 1,
  registry: ManifestRegistry = getDefaultRegistry(),
): string | undefined {
  ...
  const owner = registry.lookupOwner(file);
  ...
}
```

The internal `cache` Map disappears — `ManifestRegistry` already owns the lookup cache, so per-frame caching collapses into per-registry caching. `clearCallerCache()` is deleted.

**`createLogger`**

```ts
// after
export interface CreateLoggerOptions {
  readonly sink?: LogSink;
  readonly fallback?: string;
  readonly registry?: ManifestRegistry;   // new, optional
}
```

The logger only needs the registry transitively (via `walkOwnedErrorChain`, which doesn't read the manifest). For the logger itself nothing changes. *Documented* as: pass a registry only if you also pass a custom sink that wants per-instance manifest semantics (rare).

**`createTracer`**

```ts
// after
export interface CreateTracerOptions {
  readonly factory: SpanFactory;
  readonly fallback?: string;
  readonly registry?: ManifestRegistry;
}

// inside startSpan:
const team =
  currentOwner() ??
  normalisedOwner ??
  lookupCallerOwner(2, options.registry) ??
  fallback;
```

**`@strays/sentry/resolveOwner`**

```ts
// after
export interface ResolveOwnerOptions {
  readonly fallback?: string;
  readonly registry?: ManifestRegistry;
}

export function resolveOwnerFromEvent(
  exception: unknown,
  stacktrace: SentryStacktrace | undefined,
  opts: ResolveOwnerOptions = {},
): string {
  const registry = opts.registry ?? getDefaultRegistry();
  ...
  const owner = registry.lookupOwner(file);
  ...
}
```

The third positional `fallback` argument is preserved by overload (or migrated via a `.options` form) so external callers don't break.

### Build artifact → runtime

Today `generateManifest` returns a `ManifestOutput` JSON; it is the integrator's job to call `loadManifest(output)` somewhere at boot. Nothing forces them to.

Proposal: `@strays/build` emits a *generated TypeScript module* alongside the JSON, e.g. `dist/strays.manifest.generated.ts`:

```ts
// AUTO-GENERATED — do not edit
import { setDefaultRegistry, ManifestRegistry } from '@strays/runtime/ManifestRegistry';
import manifest from './strays.manifest.json' with { type: 'json' };
setDefaultRegistry(ManifestRegistry.fromManifest(manifest));
```

The esbuild plugin (`packages/build/src/esbuildPlugin.ts`) injects an `import './strays.manifest.generated'` at the top of the entry point during build. Side-effect import = guaranteed load before user code runs. For non-bundled consumers (library users), the README documents the one-line manual import. Dev runs without the plugin keep working because `getDefaultRegistry()` falls back to `ManifestRegistry.empty()`.

### Compile-time safety

We can move from "silently returns `undefined`" to "you must obtain a registry" by introducing a *branded* loaded type:

```ts
class ManifestRegistry { /* always callable, may miss */ }
class LoadedManifestRegistry extends ManifestRegistry {
  /* returned only by fromManifest(); guarantees at least the version field */
}
```

APIs that strictly require a populated manifest (e.g. a hypothetical `assertOwner(file): string`) take `LoadedManifestRegistry`. APIs that tolerate misses (`lookupOwner`) accept the parent. Consumers who care about "did I wire this up?" express it in their type signature; consumers who don't (the common case) get the existing best-effort behaviour. This is opt-in compile-time safety without forcing a breaking change on the 90% case.

### Test isolation

```ts
// before
afterEach(() => {
  clearManifest();
  clearCallerCache();
});

// after
it('resolves the calling file', () => {
  const registry = ManifestRegistry.fromManifest({ version: 1, files: { ... } });
  expect(lookupCallerOwner(1, registry)).toBe('Billing');
});
```

No global to clear. Each test owns its registry. The `afterEach` ceremony in `manifest.test.ts` and `lookupCallerOwner.test.ts` is deleted entirely.

## 4. Test strategy

**Tests that disappear**
- The `afterEach(clearManifest)` blocks in `manifest.test.ts` and `lookupCallerOwner.test.ts`.
- The "clearManifest invalidates lookups" test in `manifest.test.ts` — there is nothing to clear; you simply construct a different registry.
- `clearCallerCache` and its callsites — the per-file cache lived inside `lookupCallerOwner` precisely because the global manifest could change underfoot. With per-registry caching it goes away.

**New tests at the boundary**
- `ManifestRegistry.test.ts` — exact-match lookup, normalisation of `file://` and `\` separators, negative-result caching, cache hit observability (e.g. instrumented `files` getter call count).
- `defaultRegistry.test.ts` — `getDefaultRegistry()` returns a stable empty registry until `setDefaultRegistry` is called; `setDefaultRegistry` swaps atomically; `resetDefaultRegistry` is exposed *only* for the back-compat shim's tests, not the public API.
- `lookupCallerOwner.test.ts` — pass an explicit registry argument, assert no shared state with other tests in the same file (e.g. two `it()` blocks with conflicting registries on the same caller path produce different answers without any cleanup hook).
- `manifest.compat.test.ts` — the deprecated `loadManifest`/`clearManifest`/`lookupOwner` free functions still work and route through the default singleton, so existing dependents do not break.
- `sentry/resolveOwner.test.ts` — explicit-registry path and default-registry path both covered.

## 5. Trade-offs and risks

**Public API impact.** Modest. The package's `exports` map adds two new entries (`./ManifestRegistry`, `./defaultRegistry`) and keeps `./manifest` as a deprecated shim that delegates to the default singleton. Existing call sites — including third-party users on `0.1.x` — continue to compile and run. The only behaviour change visible to outsiders is that `clearManifest()` now also clears the *default* registry's cache (semantically identical to today). This is a **minor version bump (0.2.0)**, not a major one. A future `1.0.0` can drop the shim.

**Performance.** The cache is *more* effective, not less. Today there are two parallel caches (one in `manifest.ts`, one in `lookupCallerOwner.ts`) that can disagree after `clearManifest()`. In the new design each `ManifestRegistry` owns one cache, allocated once at construction; lookups cost the same `Map.get` they do today. The ALS option (C) would have added per-call `getStore()` overhead — Option A pays nothing extra. Memory footprint per registry is identical to today's globals.

**Risks.**
- *Multiple defaults*: if two bundles ship with their own copies of `@strays/runtime` (duplicated dependency), they get distinct default registries. This is already broken under the global-let model — same risk, no worse.
- *Generated module wiring*: the auto-load convention requires the build plugin to be running. Document clearly that without the plugin, the integrator must call `setDefaultRegistry` themselves; provide a one-line snippet in the README.
- *Branded `LoadedManifestRegistry`*: adds a small surface that some users will misuse (constructing a `LoadedManifestRegistry` from an empty manifest via type assertion). Mitigated by making the constructor private and only reachable through `ManifestRegistry.fromManifest`.

The deepening is real: the module's interface contracts (a value with a method) are now *narrower* than what it used to expose (free functions with hidden temporal dependencies), while the implementation hides strictly more (cache lifecycle is no longer a public concern). This is the Ousterhout shape — small interface, larger implementation that absorbs the complexity of identity, lifecycle, and isolation.
