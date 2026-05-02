# Deepened module: `resolveOwner`

A small interface in `@strays/runtime` that hides the entire team-resolution chain
(error walk -> ALS scope -> caller stack walk -> fallback) and the frame-shape
adapters that vary per vendor.

---

## 1. Problem statement

The team-resolution chain `walkOwnedErrorChain(error) ?? currentOwner() ?? lookupCallerOwner(N) ?? fallback`
is open-coded in five places: `packages/datadog/src/resolveOwner.ts`,
`packages/otel/src/resolveOwner.ts`, `packages/sentry/src/resolveOwner.ts`,
and inline inside `packages/runtime/src/createLogger.ts` and
`packages/runtime/src/createTracer.ts`. The duplication is shallow because
each call site exposes the same intent ("give me a team for this event") but
duplicates the *policy* (what the chain is, what order it runs in, how stack
frames are parsed, what counts as vendor noise) across the public surface of
every adapter. The risks are concrete: Sentry already silently diverges
(it walks frames newest-last with its own vendor regex and never calls
`lookupCallerOwner`), OTel silently drops error-walking entirely, and any
future adjustment (new vendor pattern, new chain step, new caching policy)
requires editing five files in lock-step. Test coverage of the chain itself
lives only inside the runtime package - the adapter copies are unverified.

## 2. Candidate interfaces

### A. Minimal entry point

```ts
// packages/runtime/src/resolveOwner.ts
export function resolveOwner(input?: ResolveOwnerInput): string;

interface ResolveOwnerInput {
  readonly error?: unknown;
  readonly moduleOwner?: string;
  readonly fallback?: string;
  readonly skipFrames?: number;
  readonly frames?: readonly FrameLike[]; // pre-parsed frames (Sentry path)
}
```

Usage:

```ts
const team = resolveOwner({ error: hint?.originalException, frames: sentryFrames });
```

One function, one shape. Every caller passes a partial input; the function
runs the full chain internally and skips steps whose inputs are absent.
Strength: trivial to teach; the entire chain becomes one symbol.
Weakness: the input bag is heterogeneous - `frames` is only meaningful when
the caller can't trigger `lookupCallerOwner` itself (Sentry, server-collected
events).

### B. Configurable resolver (strategy / chain steps)

```ts
type Step = (ctx: ResolveCtx) => string | undefined;
interface ResolveCtx { readonly error?: unknown; readonly frames?: readonly FrameLike[] }

export function createOwnerResolver(opts: {
  readonly steps: readonly Step[];
  readonly fallback?: string;
  readonly moduleOwner?: string;
}): (ctx?: ResolveCtx) => string;

export const fromOwnedError: Step;
export const fromCurrentScope: Step;
export const fromCallerStack: (skip?: number) => Step;
export const fromProvidedFrames: Step;
```

Usage:

```ts
const resolve = createOwnerResolver({
  steps: [fromOwnedError, fromCurrentScope, fromProvidedFrames],
  fallback: 'unowned',
});
const team = resolve({ error: hint?.originalException, frames: sentryFrames });
```

Strength: composable; an adapter can opt out of any step (OTel drops
`fromOwnedError` cleanly). Strength for testing: each step is a pure
function. Weakness: every adapter author now has to know which steps exist
and what order is correct - that knowledge is exactly what the deepened
module is supposed to hide. Pushes policy back onto the caller.

### C. Pluggable frame-source port (hybrid)

```ts
export interface FrameSource {
  /** Yields candidate file paths in the order they should be consulted. */
  frames(): Iterable<string>;
}

export const callerFrameSource: (skipFrames?: number) => FrameSource;
export const sentryFrameSource: (s: SentryStacktrace | undefined) => FrameSource;

export function resolveOwner(opts: {
  readonly error?: unknown;
  readonly frameSource?: FrameSource;
  readonly moduleOwner?: string;
  readonly fallback?: string;
}): string;
```

Usage:

```ts
const team = resolveOwner({
  error: hint?.originalException,
  frameSource: sentryFrameSource(stacktrace),
});
```

Strength: hides chain ordering and vendor-pattern filtering inside the
module while letting Sentry plug its frame shape in via a tiny port. The
port has one method and one type. Weakness: introduces a third concept
(FrameSource) that callers learn even though most of them just use the
default.

## 3. Recommended design

A hybrid of (A) and (C): a single entry point `resolveOwner(input)` that
hides the chain, plus a small `FrameSource` port that lets Sentry plug in
its own frame shape. Both live in `@strays/runtime` so every observability
adapter and the in-package factories can import without circular deps.

### Files (one symbol per file, no barrels)

```
packages/runtime/src/
  resolveOwner.ts          // export function resolveOwner
  ResolveOwnerInput.ts     // export interface ResolveOwnerInput
  FrameSource.ts           // export interface FrameSource
  callerFrameSource.ts     // export function callerFrameSource(skip?)
  fromSentryFrames.ts      // export function fromSentryFrames(stacktrace)
```

(Existing `currentOwner.ts`, `walkOwnedErrorChain.ts`, `lookupCallerOwner.ts`,
`manifest.ts` stay; they become private collaborators of `resolveOwner` and
keep their public exports for advanced users / tests.)

### Signatures

```ts
// FrameSource.ts
export interface FrameSource {
  frames(): Iterable<string>;
}

// ResolveOwnerInput.ts
export interface ResolveOwnerInput {
  /** Throwable-like value whose .cause chain may carry an OWNER_TAG. */
  readonly error?: unknown;
  /** Optional frame source. Defaults to the V8 stack of the calling code. */
  readonly frameSource?: FrameSource;
  /**
   * Owner declared at module scope (e.g. via `defineStrays` / OWNER constant).
   * Used as a tier-2 fallback before the frame source is consulted.
   */
  readonly moduleOwner?: string;
  /** Final fallback when no tier yields a team. Defaults to `'unowned'`. */
  readonly fallback?: string;
}

// resolveOwner.ts
export function resolveOwner(input?: ResolveOwnerInput): string;

// callerFrameSource.ts  (default — uses Error.captureStackTrace)
export function callerFrameSource(skipFrames?: number): FrameSource;

// fromSentryFrames.ts
export interface SentryFrame { readonly filename?: string; readonly in_app?: boolean }
export interface SentryStacktrace { readonly frames?: readonly SentryFrame[] }
export function fromSentryFrames(s: SentryStacktrace | undefined): FrameSource;
```

### Resolution order (hidden inside `resolveOwner`)

1. `walkOwnedErrorChain(input.error)` — only if `error` is provided.
2. `currentOwner()` — ALS lookup.
3. Walk `(input.frameSource ?? callerFrameSource(2))` and consult the
   manifest for the first non-vendor frame whose file is registered.
4. `input.moduleOwner` if non-empty.
5. `input.fallback ?? 'unowned'`.

### How each call site shrinks

```ts
// packages/datadog/src/resolveOwner.ts  (DELETE the file, callers import directly)
import { resolveOwner } from '@strays/runtime/resolveOwner';
// site:
span.setTag(tagKey, resolveOwner({ fallback }));
```

```ts
// packages/otel/src/resolveOwner.ts  (DELETE)
span.setAttribute(attrKey, resolveOwner({ fallback }));
```

```ts
// packages/sentry/src/resolveOwner.ts  (DELETE; thin replacement uses the port)
import { resolveOwner } from '@strays/runtime/resolveOwner';
import { fromSentryFrames } from '@strays/runtime/fromSentryFrames';
// in install.ts:
const team = resolveOwner({
  error: hint?.originalException,
  frameSource: fromSentryFrames(event.exception?.values?.[0]?.stacktrace),
  fallback,
});
```

```ts
// packages/runtime/src/createLogger.ts
const resolveTeam = (err?: unknown) =>
  resolveOwner({ error: err, moduleOwner: normalisedOwner, fallback });
// info: resolveTeam()
// error: resolveTeam(err)
```

```ts
// packages/runtime/src/createTracer.ts
const team = resolveOwner({ moduleOwner: normalisedOwner, fallback });
```

### What complexity is hidden

- Chain ordering and short-circuit semantics (one place to change).
- Cycle protection in the error walk.
- Stack-frame parsing (V8 paren / bare formats).
- Vendor-pattern filtering (`/node_modules/`, `node:`, `(internal/`, etc.) —
  applied uniformly to every `FrameSource`, including Sentry's. Sentry's
  current code re-implements its own regex; under the new design
  `fromSentryFrames` only adapts shape (`filename`, `in_app`), and the
  vendor filter lives in `resolveOwner` so the rules stay consistent.
- Caller-stack `skipFrames` defaulting (2 is right for direct callers; we
  internalise it so adapters stop guessing).
- The manifest cache fast-path.
- Iteration direction: `callerFrameSource` walks oldest-first (top of
  stack outward), `fromSentryFrames` walks newest-last (matching Sentry
  payload semantics) - direction is the FrameSource's responsibility, not
  the resolver's.

### How `createLogger` and `createTracer` consume it without circular imports

`resolveOwner` lives in `@strays/runtime/resolveOwner` and depends only on
sibling modules in the same package (`./currentOwner`, `./walkOwnedErrorChain`,
`./manifest`, `./callerFrameSource`). The factories already live in
`@strays/runtime` and import from siblings, so the import graph stays a DAG:

```
createLogger / createTracer  ->  resolveOwner  ->  { currentOwner, walkOwnedErrorChain, manifest, callerFrameSource }
```

No adapter package is on this graph; adapters import `resolveOwner` only
from outside. The Effect-TS consumer (`packages/effect/src/Logger.ts`)
swaps its inline `walkOwnedErrorChain(extractCauseError(cause))` for
`resolveOwner({ error: extractCauseError(cause), moduleOwner: annotationTeam })` -
still synchronous, still safe inside `Effect.gen`.

## 4. Test strategy

### Tests that collapse / get deleted

- `packages/runtime/src/createLogger.test.ts` keeps the high-level
  behaviours (module owner / scope / OwnedError / fallback) but stops
  re-asserting chain *order*; that responsibility moves to the new
  resolver tests.
- `packages/runtime/src/createTracer.test.ts` likewise keeps end-to-end
  attribute checks and drops chain-order assertions.
- The three adapter `resolveOwner.ts` files are deleted; they have no
  dedicated tests today (only `packages/datadog/src/install.test.ts`,
  `packages/sentry/src/install.test.ts`, `packages/otel/src/SpanProcessor.test.ts`
  exercise them indirectly), so nothing to delete on the test side.
- `walkOwnedErrorChain.test.ts` and `lookupCallerOwner.test.ts` stay -
  these are the unit tests for the *collaborators* the new module wraps.

### New boundary tests at `packages/runtime/src/resolveOwner.test.ts`

1. **Chain order, happy path** — given an `OwnedError` and an active
   `runWithOwner('Platform', ...)` scope and a manifest entry for the
   caller, returns the OwnedError's team (proves the error tier wins).
2. **Scope beats module owner beats frames** — no error provided; with a
   scope set, scope wins; without scope, `moduleOwner` wins; with neither,
   the manifest-resolved frame wins.
3. **Sentry FrameSource integration** — pass `fromSentryFrames(stacktrace)`
   with `in_app=false` on the deepest frame and a vendor frame above it;
   resolver skips both and lands on the registered frame.
4. **Fallback when nothing matches** — empty manifest, no scope, no error,
   no module owner -> returns the explicit `fallback`, defaults to
   `'unowned'` when omitted.
5. **Cyclic error chain doesn't hang** — `error: a` where `a.cause = b`
   and `b.cause = a`; resolver returns within bounded steps and falls
   through to the next tier.

A second small file `fromSentryFrames.test.ts` covers frame-shape
adaptation only (filename extraction, iteration direction, ignoring
frames with no filename).

## 5. Trade-offs and risks

The hybrid hides chain *policy* but exposes a one-method `FrameSource`
port that callers must learn if they want to plug in a non-V8 frame shape;
that's a small concept tax for a use case that today only Sentry needs.
The resolver also becomes the single point of truth for vendor filtering,
which means a too-aggressive filter regression could now silently
mis-attribute events across every adapter at once - whereas the duplicated
status quo at least localises blast radius. Mitigation: the new boundary
tests (#3 above) pin Sentry's specific filter case, and `callerFrameSource`
keeps the V8-format parsing testable in isolation. We also lose the
ability for an adapter to short-circuit the chain in unusual ways (e.g.
"only consult frames, never the scope") without growing the input shape;
if that need ever arises, the configurable-steps design (B) is a clean
upgrade path because `resolveOwner` can be re-expressed as
`createOwnerResolver([...defaultSteps])` without breaking callers.
