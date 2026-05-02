# Deepened module: framework team-middleware adapters

> Design only. No implementation. Per Ousterhout, *A Philosophy of Software Design*: a
> deep module hides a non-trivial implementation behind a small interface. Today we
> have the **opposite** — four shallow modules whose bodies are all the same one-liner,
> wrapped in framework-specific signatures, with type aliases (`TrpcMiddleware`,
> `OrpcMiddleware`, `HonoMiddleware`, `ExpressMiddleware`, plus their `Next` variants)
> redeclared in every package.

---

## 1. Problem statement

Each of `@strays/trpc`, `@strays/orpc`, `@strays/hono`, and `@strays/express` ships its
own `teamMiddleware` (or `owned`) function whose body is identical in spirit:
*invoke the framework's `next` continuation inside `runWithOwner(team, ...)`*. The
variation is **purely structural** — tRPC and oRPC pass `{ next }` and expect a
`Promise<unknown>`, Hono passes `(c, next)` and expects `Promise<void>`, Express passes
`(req, res, next)` and expects `void`. Each package also re-declares its own
`XxxMiddleware` and `XxxNext` types and (for trpc/orpc) a near-identical `teamProcedure`
builder wrapper. The interface that consumers actually want — "tag this request handler
with a team name" — is one concept, but it is implemented four times. The deepened
module should hide that single concept behind a single core function while letting each
framework package shrink to a tiny shape adapter.

---

## 2. Candidate interfaces

Throughout this section, the **deep core** lives in `@strays/runtime` and is called
`scopeOwnerTo` (working name). Its only job: given a `team` and a function that
*eventually produces the framework continuation*, run that continuation under
`runWithOwner`. The three candidates differ in how the framework adapter expresses
"how do I get `next` from these args?".

---

### Candidate A — Framework-shape adapter (factory taking a "shape" descriptor)

The core exposes a single generic factory keyed on a `MiddlewareShape` object. Each
framework package supplies a one-line shape descriptor and gets back a `(team) =>
middleware` function in that framework's native shape.

```ts
// @strays/runtime/teamMiddlewareFactory  (deep core, ~25 lines)
export interface MiddlewareShape<TArgs extends unknown[], TReturn> {
  // Given the framework's positional args, return its `next` continuation.
  readonly nextFrom: (...args: TArgs) => () => unknown;
  // Optional. Defaults to `(_, result) => result`. Express uses identity.
  readonly returnFrom?: (args: TArgs, result: unknown) => TReturn;
}

export function teamMiddlewareFactory<TArgs extends unknown[], TReturn>(
  shape: MiddlewareShape<TArgs, TReturn>,
): (team: string) => (...args: TArgs) => TReturn {
  return (team) =>
    (...args) => {
      const next = shape.nextFrom(...args);
      const out = runWithOwner(team, () => next());
      return (shape.returnFrom ?? ((_, r) => r as TReturn))(args, out);
    };
}
```

Per-framework usage shrinks to a one-liner per framework:

```ts
// @strays/trpc/teamMiddleware.ts
export const teamMiddleware = teamMiddlewareFactory<[{ next: () => Promise<unknown> }], Promise<unknown>>({
  nextFrom: ({ next }) => next,
});

// @strays/hono/teamMiddleware.ts
export const teamMiddleware = teamMiddlewareFactory<[unknown, () => Promise<void>], Promise<void>>({
  nextFrom: (_c, next) => next,
});

// @strays/express/owned.ts
export const owned = teamMiddlewareFactory<[unknown, unknown, (err?: unknown) => void], void>({
  nextFrom: (_req, _res, next) => next,
});
```

**Pros**: One core function, zero per-framework branching. Each adapter is a single
declarative shape. Type-safe via the `TArgs`/`TReturn` generics.

**Cons**: Generics are visually heavy. The `returnFrom` escape hatch exists only for
edge cases (none today) but adds an unused parameter. Express returns `void` so the
core's `runWithOwner(...) ; return ...` shape needs to gracefully discard the
`Promise<void>` Hono returns vs. the synchronous-`void` Express returns — solvable but
the type story for "result passes through" is the tricky part.

---

### Candidate B — Callback-style normalizer (every `next` becomes `() => Promise<void>`)

The core never sees the framework signature. Instead it exposes one function operating
on a normalized `next`. Each framework adapter is responsible for receiving its native
args and calling the core with a thunk.

```ts
// @strays/runtime/scopeOwnerTo  (deep core, ~6 lines)
export function scopeOwnerTo<TResult>(
  team: string,
  next: () => TResult,
): TResult {
  return runWithOwner(team, next);
}
```

Per-framework adapters:

```ts
// @strays/trpc/teamMiddleware.ts
export const teamMiddleware = (team: string) =>
  ({ next }: { next: () => Promise<unknown> }) => scopeOwnerTo(team, next);

// @strays/hono/teamMiddleware.ts
export const teamMiddleware = (team: string) =>
  (_c: unknown, next: () => Promise<void>) => scopeOwnerTo(team, next);

// @strays/express/owned.ts
export const owned = (team: string) =>
  (_req: unknown, _res: unknown, next: (err?: unknown) => void) =>
    scopeOwnerTo(team, () => next());
```

**Pros**: The deepest, simplest core — it is essentially `runWithOwner` renamed for
this use case. Easy to reason about. No generics in the core.

**Cons**: Honestly, `scopeOwnerTo(team, next)` is so close to `runWithOwner(team, () =>
next())` that the "deep" core is barely a module. The framework packages still each
contain a hand-written tiny lambda — saving 3-4 lines per package but **not** removing
the redeclared `XxxMiddleware`/`XxxNext` type aliases (those still live per package).
This is a renaming, not a deepening.

---

### Candidate C — Curried "where is next" extractor (functional middle ground)

Take the cleanest piece of A and B. Core is a curried function: give it an extractor
function that says "given the framework's args, here is the next thunk", and it
returns a framework middleware.

```ts
// @strays/runtime/withTeamScope  (deep core, ~12 lines)
export type NextThunk = () => unknown;

export function withTeamScope<TArgs extends unknown[], TReturn = unknown>(
  pickNext: (...args: TArgs) => NextThunk,
): (team: string) => (...args: TArgs) => TReturn {
  return (team) =>
    ((...args: TArgs) => runWithOwner(team, () => pickNext(...args)())) as (
      ...args: TArgs
    ) => TReturn;
}
```

Per-framework adapters become a single `const`:

```ts
// @strays/trpc/teamMiddleware.ts
export const teamMiddleware = withTeamScope<
  [{ next: () => Promise<unknown> }],
  Promise<unknown>
>(({ next }) => next);

// @strays/orpc/teamMiddleware.ts
export const teamMiddleware = withTeamScope<
  [{ next: () => Promise<unknown> }],
  Promise<unknown>
>(({ next }) => next);

// @strays/hono/teamMiddleware.ts
export const teamMiddleware = withTeamScope<
  [unknown, () => Promise<void>],
  Promise<void>
>((_c, next) => next);

// @strays/express/owned.ts
export const owned = withTeamScope<
  [unknown, unknown, (err?: unknown) => void],
  void
>((_req, _res, next) => () => next());
```

**Pros**: Smaller core than A (no `returnFrom` ceremony). Each framework adapter is
genuinely a single expression — the per-framework file is ~5 lines including the
import.

**Cons**: The `<TArgs, TReturn>` generic pair is still verbose at every call site, and
TypeScript will need them stated explicitly because they cannot be inferred from
`pickNext` alone (it can infer `TArgs` but not `TReturn`).

---

## 3. Recommended design — Candidate C, with a small ergonomic refinement

I recommend **Candidate C** (curried extractor), promoted to the canonical pattern.
It keeps the deep core's responsibility to one true thing — *"run a thunk under
`runWithOwner` and pass through whatever it returns"* — while reducing each framework
adapter to a single `const`. Candidate B is too shallow (a rename of `runWithOwner`).
Candidate A's `returnFrom` is dead weight; we have no use case for it today.

### Where the deep core lives

`@strays/runtime/withTeamScope` (new file `packages/runtime/src/withTeamScope.ts`,
exported via `package.json#exports./withTeamScope`).

**Why `@strays/runtime` and not a new package**:

- Every framework adapter already depends on `@strays/runtime` for `runWithOwner`.
- The function is one tightly-coupled cousin of `runWithOwner` and `currentOwner`.
- A new `@strays/middleware-core` package would be ceremony for ~12 lines of code.
- The repo convention is one function per file — adding a single file to runtime is
  the lowest-friction option.

### Exact signatures

```ts
// packages/runtime/src/withTeamScope.ts
import { runWithOwner } from './runWithOwner.ts';

/**
 * A thunk that yields control to whatever the framework considers "next".
 * The return type is intentionally `unknown` — frameworks discard, await, or
 * forward this value as their signature requires.
 */
export type NextThunk = () => unknown;

/**
 * Build a framework-shaped middleware factory.
 *
 * `pickNext` extracts the framework's continuation from its native call args.
 * The returned factory takes a team name and yields a middleware whose call
 * shape is exactly `(...args) => TReturn`.
 *
 * Behavioral guarantees:
 *  - The continuation runs inside `runWithOwner(team, ...)`.
 *  - Whatever the continuation returns is returned directly to the framework
 *    (so async frameworks can `await` it, sync frameworks see `undefined`).
 *  - The owner scope does not leak past the synchronous return of `pickNext`.
 */
export function withTeamScope<TArgs extends readonly unknown[], TReturn = unknown>(
  pickNext: (...args: TArgs) => NextThunk,
): (team: string) => (...args: TArgs) => TReturn {
  return (team) =>
    ((...args: TArgs) => runWithOwner(team, () => pickNext(...args)())) as (
      ...args: TArgs
    ) => TReturn;
}
```

That is the entire deep core. ~12 lines including types and the JSDoc.

### Before / after for each framework

#### tRPC

**Before** (`packages/trpc/src/teamMiddleware.ts`, 16 lines):
```ts
import { runWithOwner } from '@strays/runtime/runWithOwner';

export interface TrpcMiddlewareNext {
  (): Promise<unknown>;
  <T>(opts: { ctx: T }): Promise<unknown>;
}
export interface TrpcMiddlewareOpts { readonly next: TrpcMiddlewareNext; }
export type TrpcMiddleware = <TOpts extends TrpcMiddlewareOpts>(opts: TOpts) => Promise<unknown>;

export function teamMiddleware(team: string): TrpcMiddleware {
  return ({ next }) => runWithOwner(team, () => next());
}
```

**After** (~5 lines):
```ts
import { withTeamScope } from '@strays/runtime/withTeamScope';

export const teamMiddleware = withTeamScope<
  [{ next: () => Promise<unknown> }],
  Promise<unknown>
>(({ next }) => next);
```

The `TrpcMiddleware` / `TrpcMiddlewareNext` / `TrpcMiddlewareOpts` named types
**disappear**. Consumers who need the inferred middleware type write
`type TrpcMiddleware = ReturnType<typeof teamMiddleware>` at the call site (or we
re-derive it — see "Type ergonomics" below).

#### oRPC

**Before** (`packages/orpc/src/teamMiddleware.ts`, 11 lines): same shape, same body.

**After** (~5 lines):
```ts
import { withTeamScope } from '@strays/runtime/withTeamScope';

export const teamMiddleware = withTeamScope<
  [{ next: () => Promise<unknown> }],
  Promise<unknown>
>(({ next }) => next);
```

(oRPC and tRPC have *literally the same* call shape today; the duplication is now
visibly identical, which is a feature, not a bug — it makes the question "should these
be one package?" answerable.)

#### Hono

**Before** (`packages/hono/src/teamMiddleware.ts`, 9 lines):
```ts
import { runWithOwner } from '@strays/runtime/runWithOwner';
export type HonoNext = () => Promise<void>;
export type HonoMiddleware = (c: unknown, next: HonoNext) => Promise<void>;
export function teamMiddleware(team: string): HonoMiddleware {
  return (_c, next) => runWithOwner(team, () => next());
}
```

**After**:
```ts
import { withTeamScope } from '@strays/runtime/withTeamScope';

export const teamMiddleware = withTeamScope<
  [unknown, () => Promise<void>],
  Promise<void>
>((_c, next) => next);
```

#### Express

**Before** (`packages/express/src/owned.ts`, 10 lines):
```ts
import { runWithOwner } from '@strays/runtime/runWithOwner';
export type ExpressNext = (err?: unknown) => void;
export type ExpressMiddleware = (req: unknown, res: unknown, next: ExpressNext) => void;
export function owned(team: string): ExpressMiddleware {
  return (_req, _res, next) => {
    runWithOwner(team, () => next());
  };
}
```

**After**:
```ts
import { withTeamScope } from '@strays/runtime/withTeamScope';

export const owned = withTeamScope<
  [unknown, unknown, (err?: unknown) => void],
  void
>((_req, _res, next) => () => next());
```

The Express case is the only one that genuinely **transforms** `next`: the framework's
`next` accepts an optional `err` argument, but inside `runWithOwner` we want a thunk.
The extractor returns `() => next()` — a fresh zero-arg lambda — which is exactly the
"shape adapter" responsibility C is built for. The synchronous-`void` return type is
honored because `runWithOwner` returns synchronously when the thunk is synchronous.

### `teamProcedure` (tRPC + oRPC builder wrappers)

These remain per-package because they reference `builder.use(...)`, which is a
framework-specific ergonomic. But they can be reduced to a one-line call against
`teamMiddleware` (which they already do). The named `TrpcProcedureBuilder` /
`OrpcProcedureBuilder` interfaces stay — they describe a third party (tRPC/oRPC's
builder), not a re-export.

```ts
// packages/trpc/src/teamProcedure.ts (unchanged structurally)
import { teamMiddleware } from './teamMiddleware.ts';

export interface TrpcProcedureBuilder {
  use(middleware: ReturnType<typeof teamMiddleware>): this;
}

export function teamProcedure<T extends TrpcProcedureBuilder>(builder: T, team: string): T {
  return builder.use(teamMiddleware(team));
}
```

The only change is the `use(...)` parameter type uses `ReturnType<typeof
teamMiddleware>` rather than the now-deleted local `TrpcMiddleware` alias. (Or, to
keep public-facing names for downstream typing, re-export `type TrpcMiddleware =
ReturnType<typeof teamMiddleware>` — see next subsection.)

### Adding a 5th framework (e.g., Fastify)

Fastify's middleware shape is `(req, reply, done) => void` (where `done` is a callback).
Adding it requires **one file**:

```ts
// packages/fastify/src/teamMiddleware.ts  (new — 5 lines)
import { withTeamScope } from '@strays/runtime/withTeamScope';

export const teamMiddleware = withTeamScope<
  [unknown, unknown, (err?: unknown) => void],
  void
>((_req, _reply, done) => () => done());
```

Plus a `package.json` declaring `@strays/runtime` as a dep and exporting
`./teamMiddleware`. **No** changes to the deep core. **No** new type aliases unless
the package author wants public-facing names.

### Type ergonomics: keeping framework-native types visible

The pre-refactor packages exported named types (`TrpcMiddleware`, `HonoMiddleware`,
etc.) so downstream consumers could write `function applyOurThing(mw: TrpcMiddleware)`.
After the refactor, the recommended pattern is:

```ts
// In each package, alongside the const:
export const teamMiddleware = withTeamScope<...>(...);
export type TeamMiddleware = ReturnType<typeof teamMiddleware>;
```

This:
- Preserves the public type symbol (renamed from `TrpcMiddleware` → `TeamMiddleware`,
  scoped per package; consumers write `TrpcTeamMiddleware` via
  `import type { TeamMiddleware as TrpcTeamMiddleware } from '@strays/trpc/teamMiddleware'`).
- Costs one line per package.
- Stays no-barrel-exports compliant — each file owns its own exports.
- Does not require the deep core to know any framework type names.

If we want a more ergonomic alias (avoiding `ReturnType<typeof ...>` plumbing), we
could expose a tiny generic helper from `@strays/runtime`:

```ts
// @strays/runtime/withTeamScope.ts
export type TeamMiddleware<TArgs extends readonly unknown[], TReturn> =
  (...args: TArgs) => TReturn;
```

…and let each framework package alias it. But honestly, `ReturnType<typeof
teamMiddleware>` works without ceremony.

---

## 4. Test strategy

### Core test (new file): `packages/runtime/src/withTeamScope.test.ts`

This becomes the single home for the *behavioral contract* every framework relies on.
It must assert:

1. The thunk returned by `pickNext` runs with `currentOwner() === team`.
2. The thunk's return value (sync or `Promise`) is returned to the caller verbatim.
3. The owner scope is **not** active after `pickNext()` synchronously returns and the
   thunk has finished — the caller observes `undefined`.
4. Promises returned by the thunk preserve the scope across `await` boundaries
   (`AsyncLocalStorage` does this; the test pins it in place).
5. Nested invocations shadow the outer scope and unwind correctly.
6. Errors thrown by the thunk propagate without leaking the scope.

These six assertions span ~50 lines and replace **all the equivalent assertions
currently duplicated** across the four framework test files.

### Per-framework "shape" smoke tests (5–10 lines each)

Once the core is trusted, each framework's `teamMiddleware.test.ts` only needs to
verify *that the framework's call shape is wired correctly* — i.e., the `pickNext`
extractor pulls `next` from the right argument position. One assertion per file:

```ts
// packages/trpc/src/teamMiddleware.test.ts (after — ~10 lines)
import { describe, expect, it } from 'bun:test';
import { currentOwner } from '@strays/runtime/currentOwner';
import { teamMiddleware } from './teamMiddleware.ts';

describe('trpc teamMiddleware shape', () => {
  it('extracts `next` from the opts object and runs it under the team scope', async () => {
    let observed: string | undefined;
    await teamMiddleware('Billing')({ next: async () => { observed = currentOwner(); } });
    expect(observed).toBe('Billing');
  });
});
```

Hono's smoke test asserts `(c, next)` positional extraction. Express asserts
`(req, res, next)` and the `void` return type. oRPC asserts `({ next })` extraction
(identical to tRPC — and that's fine, the test documents that the wiring is correct).

### Tests that collapse

- All of `packages/trpc/src/teamMiddleware.test.ts` (5 tests, 72 lines) → 1 test, ~10
  lines. The "preserves scope across awaits", "shadows outer scope", "doesn't leak",
  and "returns next() value" cases all move to the runtime core test.
- All of `packages/orpc/src/teamMiddleware.test.ts` (6 tests, 87 lines) → 1 test.
  (oRPC additionally tests error propagation — that, too, becomes a core test.)
- All of `packages/hono/src/teamMiddleware.test.ts` (5 tests, 74 lines) → 1 test.
- All of `packages/express/src/owned.test.ts` (6 tests, 93 lines) → 1 test, plus
  optionally a second tiny test that pins the synchronous-return shape (Express is
  the one framework where return-value behavior diverges).
- `teamProcedure.test.ts` files (trpc + orpc) stay essentially as-is — they test the
  builder wrapping, not the middleware body.

Net change: ~326 lines of duplicated test logic → ~50 lines of core test + ~40 lines
of shape smokes = ~236 lines deleted, with **stronger** behavioral coverage (one
canonical location instead of four divergent copies).

---

## 5. Trade-offs and risks

**Risk: type inference at the call site.** TypeScript can infer `TArgs` from
`pickNext`'s parameters but cannot infer `TReturn` from a function body that returns a
thunk. Each framework adapter therefore states `<TArgs, TReturn>` explicitly. This is
the chief readability cost. Mitigation: the explicit generics double as documentation
of "this package binds the X framework's middleware shape".

**Risk: lost named types** (`TrpcMiddleware`, `HonoMiddleware`, etc.). Anyone
importing those breaks. Mitigation: re-export `type TeamMiddleware = ReturnType<typeof
teamMiddleware>` per package — single line, no information loss. (And in practice,
grep across the repo before deletion to confirm no external imports.)

**Risk: the abstraction proves too small to justify itself.** This is genuine. The
deep core is ~12 lines. The frameworks each save ~5–10 lines. Total LOC delta is
modest. The win is **conceptual**: "tag this handler with a team" becomes one named
function (`withTeamScope`) tested in one place, and adding a 5th framework is a
five-line file. Per Ousterhout, the value of a deep module is that *the interface is
much smaller than the implementation it hides* — here the interface is `withTeamScope
+ pickNext`, and the hidden implementation is "AsyncLocalStorage scope management
across four divergent middleware calling conventions". That asymmetry is real even if
the LOC numbers are small.

**Risk: framework-specific argument quirks** (e.g., Express's `next(err)`, tRPC's
overloaded `next({ ctx })` for context augmentation). The current implementations
**already** ignore those — none of the four packages does anything with `err` or
`ctx`. The refactor preserves the same behavior; if richer per-framework behavior is
ever needed (e.g., propagating thrown errors via Express's `next(err)`), each adapter
file is the natural home for it without touching the core.

**Trade-off vs. Candidate A.** A's `returnFrom` hook would be useful if a future
framework needed to wrap the result (e.g., transform the response). We don't need it
today. If we ever do, promoting C to A is a backward-compatible additive change —
default `returnFrom` to identity.

**Trade-off vs. Candidate B.** B is genuinely simpler but doesn't actually deepen the
module — it just renames `runWithOwner`. The four framework files keep their hand-rolled
lambdas and per-package type aliases. C is the smallest step that meaningfully reduces
the per-framework surface to "one declarative shape statement".
