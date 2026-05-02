# Deepening `transformLoggerImports`: from regex to a unified AST pass

This is a design (not an implementation) for collapsing
`packages/build/src/transformLoggerImports.ts` and the related per-file
work in `esbuildPlugin.ts` into a single deeper AST-driven module
inside `@strays/build`.

The exercise follows Ousterhout's "A Philosophy of Software Design":
prefer fewer, deeper modules; absorb related complexity behind one
interface; eliminate parallel machineries that look at the same
substrate.

---

## 1. Problem statement

`@strays/build` currently runs **two separate pieces of machinery over
every loaded source file**:

1. `extract.ts` — a real AST walker built on `ts-morph`. It parses the
   file once via `Project.createSourceFile`, walks classes, reads
   leading comments, and extracts the `@owner` JSDoc tag plus
   `OwnedError` super-call owners.
2. `transformLoggerImports.ts` — ~53 lines of hand-rolled regex
   (`IMPORT_REGEX`, plus a hand-rolled `parseNamedImports`) that
   text-replaces `import { logger, tracer } from '@strays/runtime'`
   with split imports plus a `const logger = createLogger(__OWNER__)`
   initializer.

These two pieces look at the **same source text** but with completely
different tools. That's the deepening anti-signal: the module boundary
follows the implementation technique (regex vs AST) rather than the
problem domain (per-file owner-aware rewriting).

The cost of that split shows up immediately in correctness. The regex
silently fails on every shape that isn't the exact `import { x, y }
from '@strays/runtime'` literal:

| Edge case                                                  | Current behavior                              |
| ---------------------------------------------------------- | --------------------------------------------- |
| `import * as runtime from '@strays/runtime'`               | Not matched. `runtime.logger` is left alone, never gets an owner. |
| `import type { logger } from '@strays/runtime'`            | Matched, rewritten into a runtime `const` — wrong; the import was erased at compile time. |
| `import { logger, /* keep */ runWithOwner } from ...`      | The trailing-comment form survives, but block comments inside the brace list defeat the lazy `[^}]+?` group. |
| Multi-line imports with trailing commas                    | Brittle; works only because of the lazy match. |
| Re-export: `export { logger } from '@strays/runtime'`      | Not matched. A downstream consumer that does `import { logger } from './reexport.ts'` gets a logger with no owner. |
| Future runtime export (`createMetrics`, `createCounter`…)  | Requires editing `FACTORY_MAP` *and* `IMPORT_REGEX`'s allowed sub-paths. Easy to forget. |
| Imports with a different specifier shape (e.g. dynamic `import('@strays/runtime')`) | Silently unhandled. |

There is also a smaller, structural problem. `esbuildPlugin.ts` does
the per-file dance manually:

```ts
const extraction = extractFromSourceText(relativePath, source); // parse #1 (ts-morph)
const resolved   = resolveOwnerForFile(...);
let transformed  = transformLoggerImports(source);              // parse #2 (regex)
transformed      = injectOwnerConstant(transformed, owner);     // parse #3 (regex)
```

Every loaded file is scanned three times by three different
mechanisms. Two of the three are regex-flavored and lossy.

That's the friction. The fix is to make one module own
"per-file owner-aware preprocessing" end to end.

---

## 2. Candidate interfaces

### A. Unified AST pass — `analyzeSourceFile`

One deep module with one entry point:

```ts
// packages/build/src/analyzeSourceFile.ts
export interface AnalyzedFile {
  readonly filePath: string;
  readonly jsdocOwner: string | undefined;
  readonly ownedErrorConstructions: readonly OwnedErrorConstruction[];
  readonly transform: (resolvedOwner: string) => string;
}

export function analyzeSourceFile(
  filePath: string,
  sourceText: string,
): AnalyzedFile;
```

The function parses with `ts-morph` exactly once. It returns the
extraction data the rule resolver needs **and** a closure that, when
called with the resolved owner string, produces the transformed source
text. The closure is a pure function over the already-parsed AST — no
re-parsing.

Pros:

- Single parse per file. Fastest.
- Correctness comes from the parser; namespace imports, type-only
  imports, re-exports are all distinguishable.
- The plugin shrinks to a five-line function.
- Future runtime exports become a one-line addition to a `FACTORY_MAP`
  consulted by the AST visitor — no regex churn.

Cons:

- Slightly leakier interface (the closure carries the source file
  reference). Mitigatable by computing both representations upfront and
  returning `{ extraction, transformWithOwner }` or by moving owner
  resolution inside the module (rejected — that would couple it to
  `resolveRules.ts`).
- The closure means the source file must stay live until transform
  time. Acceptable; we're inside a single esbuild `onLoad` call.

### B. Composable visitor pipeline

Same single parse, but expose three independently-testable AST
visitors and a runner:

```ts
// packages/build/src/sourceFilePass.ts
export interface SourceFileVisitor<TInput, TOutput> {
  readonly name: string;
  readonly run: (sourceFile: SourceFile, input: TInput) => TOutput;
}

export const extractOwnerVisitor:        SourceFileVisitor<void,   { owner?: string }>;
export const extractOwnedErrorsVisitor:  SourceFileVisitor<void,   OwnedErrorConstruction[]>;
export const rewriteRuntimeImportsVisitor: SourceFileVisitor<{ owner: string }, void>;
export const injectOwnerConstantVisitor:   SourceFileVisitor<{ owner: string }, void>;

export function runPipeline(
  filePath: string,
  sourceText: string,
  owner: string,
): { extraction: FileExtraction; transformedText: string };
```

Pros:

- Each visitor is testable in isolation against a fixture AST.
- Adding new behavior (e.g. "stamp `@deprecated` owners with a
  banner") is a new visitor, no rewrite of the orchestrator.

Cons:

- More moving pieces than (A). "Composable visitor pipeline" is
  itself a shallow abstraction at this scale (three visitors, one
  runner) — Ousterhout would call this over-engineered.
- Owner resolution still happens *outside* the pipeline, so the
  pipeline must be re-runnable: parse, extract owner, hand owner back
  to caller, parse-again-or-mutate. Either way, more contract surface
  than (A).

### C. Stay-as-regex but harden it

Keep `transformLoggerImports.ts` as regex, but:

- Require a closing `;` and explicit `from '@strays/runtime'` (no
  sub-paths).
- Detect and **throw loudly** on `import * as`, `import type`, and
  `export {…} from '@strays/runtime'` shapes.
- Replace `FACTORY_MAP` with a registry the runtime package itself
  publishes (so future runtime exports auto-register).

Pros:

- Zero new dependency surface. Regex is fast.
- Fail-loud already removes the *silent*-failure class of bugs.

Cons (and why I'm pushing back on it):

- The regex is already brittle (the `[^}]+?` group, the optional
  semicolon, the conditional sub-path). Hardening it means *adding*
  rules, not removing. Each new rule is another case the parser
  already handles for free.
- `extract.ts` has already paid the `ts-morph` startup cost on this
  same file. We are not saving anything by keeping a second
  representation — we are paying twice.
- "Throw loudly on namespace imports" is a real regression: today
  someone *can* write `import * as runtime from '@strays/runtime'` and
  it just silently doesn't get owner-stamped. Switching that to a hard
  error breaks existing code without giving us the right answer (which
  is "stamp it correctly").
- The runtime-side registry idea is good but orthogonal — it works
  with (A) too.

So (C) is a worse Pareto point than (A): it costs more correctness work
and gives us less correctness. Rejected.

---

## 3. Recommended design — option A, "unified AST pass"

### Module structure

```
packages/build/src/
  analyzeSourceFile.ts         # NEW — the deep module
  analyzeSourceFile.test.ts    # NEW — AST-level boundary tests
  esbuildPlugin.ts             # SHRUNK — orchestrator only
  esbuildPlugin.test.ts        # unchanged shape; new edge cases pass
  extract.ts                   # DELETED — folded into analyzeSourceFile
  extract.test.ts              # DELETED — replaced by analyzeSourceFile.test.ts
  injectOwnerConstant.ts       # DELETED — folded into analyzeSourceFile
  injectOwnerConstant.test.ts  # DELETED — replaced by analyzeSourceFile.test.ts
  transformLoggerImports.ts    # DELETED — folded into analyzeSourceFile
  transformLoggerImports.test.ts # DELETED — replaced by analyzeSourceFile.test.ts
  resolveRules.ts              # unchanged
  generateCodeowners.ts        # unchanged (consumes extract.ts API)
  generateManifest.ts          # unchanged
```

`generateCodeowners.ts` and `generateManifest.ts` only need the
*read-only* extraction data, never the transform. The new module
exposes that as a separate entry point so non-transform consumers
don't pay for the transform machinery.

`package.json#exports` (no barrel exports — direct module entries):

```jsonc
{
  "exports": {
    "./analyzeSourceFile": "./src/analyzeSourceFile.ts",
    "./resolveRules": "./src/resolveRules.ts",
    "./generateCodeowners": "./src/generateCodeowners.ts",
    "./generateManifest": "./src/generateManifest.ts",
    "./esbuildPlugin": "./src/esbuildPlugin.ts"
  }
}
```

The four old per-file entries (`./extract`, `./injectOwnerConstant`,
`./transformLoggerImports`, …) are removed. There's a coordinated
update to `generateCodeowners.ts` to import `extractFromSourceText`
from `./analyzeSourceFile.ts` instead of `./extract.ts`.

### Signatures

```ts
// packages/build/src/analyzeSourceFile.ts
import { Project, SourceFile, SyntaxKind, type ts } from 'ts-morph';

export interface OwnedErrorConstruction {
  readonly className: string;
  readonly owner: string;
  readonly line: number;
}

export interface FileExtraction {
  readonly filePath: string;
  readonly jsdocOwner: string | undefined;
  readonly ownedErrorConstructions: readonly OwnedErrorConstruction[];
}

export interface AnalyzedFile extends FileExtraction {
  /**
   * Produce the rewritten source text for this file, given the
   * caller-resolved owner string. Pure with respect to the parsed AST.
   * Calling this multiple times with different owners is well-defined.
   */
  readonly transform: (resolvedOwner: string) => string;
}

/** Read-only path used by manifest + codeowners generators. */
export function extractFromSourceText(
  filePath: string,
  sourceText: string,
): FileExtraction;

/** Read + transform path used by the esbuild plugin. */
export function analyzeSourceFile(
  filePath: string,
  sourceText: string,
): AnalyzedFile;
```

Internally:

- A single `Project({ useInMemoryFileSystem: true })` parses the file.
- `extractFromSourceText` is implemented as `analyzeSourceFile(...)`
  with the `transform` field stripped — so generators that don't need
  rewriting still get the cheap path conceptually, with the cost of one
  unused closure (negligible — `ts-morph` is already amortising).
- `transform(owner)` walks the AST a second time (against the same
  parsed `SourceFile`) using `ts-morph`'s structural APIs:
  - For each `ImportDeclaration` whose module specifier is
    `@strays/runtime` (or a sub-path like
    `@strays/runtime/createLogger`): inspect the named bindings.
    - If `isTypeOnly` → leave alone.
    - If namespace import (`import * as ns`) → leave the import,
      but record the local namespace name. Walk all
      `PropertyAccessExpression` nodes (`ns.logger`, `ns.tracer`) and
      rewrite them to call sites of factory-bound locals (or, more
      conservatively, emit a per-file shim and warn).
    - For each named binding whose name is a key in `FACTORY_MAP`:
      remove that name from the import, replace it with a
      `import { createLogger } from '@strays/runtime/createLogger'`
      declaration plus a `const logger = createLogger(__OWNER__)`
      statement inserted at the top of the file body.
    - Names not in `FACTORY_MAP` are left in the original import
      declaration. If that leaves the import empty, drop it.
  - For each `ExportDeclaration` re-exporting from
    `@strays/runtime`: same treatment, rewritten to a re-export of the
    factory module — or, if the re-exported name is owner-bound,
    rejected with a *deliberate* compile-time error (`@strays/runtime`
    re-exports of owner-bound symbols are meaningless; the owner of the
    re-exporting module would silently win).
- `transform(owner)` also injects the `__OWNER__` constant. The
  AST knows where `"use strict"` / `"use client"` directives end (via
  the `Statement` list), so the directive-preservation logic that
  currently lives in `injectOwnerConstant.ts` collapses to an `index`
  in the statement array — no regex.

`FACTORY_MAP` continues to live in `analyzeSourceFile.ts`, but
because lookups happen by **identifier name on a parsed import**, not
by regex match on a source string, adding a new runtime export
(`createMetrics`, `createCounter`) is a single line:

```ts
const FACTORY_MAP: Record<string, string> = {
  logger:  'createLogger',
  tracer:  'createTracer',
  metrics: 'createMetrics', // future
};
```

No regex, no per-export sub-path allowlist. Optionally, the runtime
package can export this map directly (e.g.
`@strays/runtime/factories`) so the build package never needs editing
to pick up new runtime exports.

### How `esbuildPlugin.ts` consumes it

The plugin shrinks from ~50 lines of orchestration into a thin
adapter:

```ts
// packages/build/src/esbuildPlugin.ts
import { readFile } from 'node:fs/promises';
import { extname, relative } from 'node:path';
import type { Plugin } from 'esbuild';
import type { Owner, StraysConfig } from '@strays/core/types';
import { analyzeSourceFile } from './analyzeSourceFile.ts';
import { resolveOwnerForFile } from './resolveRules.ts';

const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts'] as const;

export function strays<TOwners extends Record<string, Owner>>(
  options: StraysPluginOptions<TOwners>,
): Plugin {
  const extensions = options.extensions ?? DEFAULT_EXTENSIONS;
  return {
    name: '@strays/build',
    setup(build) {
      build.onLoad({ filter: /.*/ }, async (args) => {
        if (!extensions.includes(extname(args.path))) return undefined;
        const source = await readFile(args.path, 'utf8');
        const relativePath = relative(options.projectRoot, args.path).replace(/\\/g, '/');

        const analyzed = analyzeSourceFile(relativePath, source);
        const resolved = resolveOwnerForFile(options.config, {
          filePath:   relativePath,
          jsdocOwner: analyzed.jsdocOwner,
        });
        if (!resolved) return undefined;

        return {
          contents: analyzed.transform(resolved.owners[0] ?? ''),
          loader:   pickLoader(args.path),
        };
      });
    },
  };
}
```

The plugin no longer knows about `transformLoggerImports`,
`injectOwnerConstant`, or `extractFromSourceText` independently. It
talks to one module.

### What happens to `injectOwnerConstant.ts`

It merges in. Its current responsibilities:

1. Pick the right insertion point given `"use strict"` / `"use client"`
   leading directives.
2. Emit `const __OWNER__ = JSON.stringify(owner);`.

(1) becomes "find the index of the first non-directive statement in
the parsed `SourceFile.statements`". `ts-morph` already classifies
directives correctly. (2) is a one-liner that the AST emitter handles
via `sourceFile.insertStatements(idx, …)`.

Net result: the file disappears, its tests are replaced by AST-level
boundary tests inside `analyzeSourceFile.test.ts`.

### How future runtime exports auto-work

Two cumulative wins:

1. The transformer dispatches on **identifier name on a parsed
   `ImportSpecifier`**, not on a regex over source text. Adding a new
   factory is a `FACTORY_MAP` entry.
2. If `@strays/runtime` exports `factoryMap` from
   `@strays/runtime/factories`, the build package can `import
   { factoryMap } from '@strays/runtime/factories'` once, and the
   transformer never needs editing to support new runtime exports —
   the registry lives next to the implementations, not next to the
   build tool.

---

## 4. Test strategy

### New AST-level boundary tests (`analyzeSourceFile.test.ts`)

The realistic edge cases the new design must cover, each as a single
parse-and-assert test:

1. **Plain named import** (regression):
   `import { logger } from '@strays/runtime'` → factory init present.
2. **Type-only import is preserved**:
   `import type { logger } from '@strays/runtime'` → output is
   byte-identical to input. (This is the test that actually motivates
   the rewrite.)
3. **Namespace import is preserved and walked**:
   `import * as runtime from '@strays/runtime'; runtime.logger.info({...})`
   → either
   (a) the namespace import is preserved verbatim and a property-access
   rewrite stamps `__OWNER__` at each call site, or
   (b) (initial scope) the namespace import is preserved, no
   transformation happens, and a deliberate `// @strays: namespace
   import not owner-stamped` warning comment is emitted. Pick (a) for
   correctness; the test asserts the call site is owner-stamped.
4. **Mixed named imports**:
   `import { logger, runWithOwner } from '@strays/runtime'` → output
   has a `runWithOwner` import from `@strays/runtime` and a
   `createLogger` import from `@strays/runtime/createLogger`, in any
   order, and only one `const logger = …`.
5. **Aliased import**:
   `import { logger as log } from '@strays/runtime'` → `const log =
   createLogger(__OWNER__);`, no `const logger`.
6. **Re-export**:
   `export { logger } from '@strays/runtime';` → either rewritten to
   `export { logger } from './owner-bound-shim.ts'` or rejected with a
   structured diagnostic. Test asserts whichever policy we pick — the
   point is no silent pass-through.
7. **Multi-line import with trailing comma and inline block comment**:
   parser handles it; output is correct.
8. **`@owner` JSDoc still extracted** (regression for `extract.ts`):
   leading `/** @owner Billing */` → `analyzed.jsdocOwner === 'Billing'`.
9. **`OwnedError` super-call still extracted** (regression):
   one parse pass yields both extraction and transform output.
10. **`"use strict"` and `"use client"` directives preserved**:
    `__OWNER__` is injected after the directive, not before.
11. **Empty owner string**: `transform('')` produces
    `const __OWNER__ = "";` and a `createLogger('')` call (matches
    today's behavior — `createLogger` already normalises the empty
    string to `undefined`).
12. **Idempotency**: feeding the output back through
    `analyzeSourceFile(...).transform(owner)` is a no-op (or, more
    pragmatically: re-running doesn't double-inject `__OWNER__` and
    doesn't re-rewrite already-rewritten imports). Important for
    incremental rebuilds.

### Old regex-string-matching tests that get deleted

From `transformLoggerImports.test.ts`:

- `'rewrites a single logger import to a createLogger factory call'`
- `'rewrites tracer imports to createTracer factory calls'`
- `'rewrites both logger and tracer in the same import'`
- `'preserves unrelated named imports from the same specifier'`
- `'honours import aliases'`
- `'does not touch unrelated imports'`
- `'uses double quotes when the original import uses double quotes'`
  — deleted; replaced by structural assertions ("the rewritten
  import is parseable and imports `createLogger`"), not by quote-style
  assertions. The AST emitter picks one quote style; the test
  shouldn't care.

From `injectOwnerConstant.test.ts`:

- `'prepends the constant to a plain module'`
- `'uses JSON.stringify so quotes/backslashes are escaped'`
- `'preserves "use strict" directive at the top of the file'`
- `'preserves "use client" directive at the top of the file'`
  — deleted; the equivalent assertions move into
  `analyzeSourceFile.test.ts` cases (10) and (11).

From `extract.test.ts`:

- All seven existing cases survive verbatim; only the import path
  changes (`./extract.ts` → `./analyzeSourceFile.ts`). Effectively the
  file is renamed and its tests inlined.

### Esbuild plugin tests

Existing `esbuildPlugin.test.ts` (assumed to exist; not read here)
keeps its shape. New end-to-end edge case: a fixture file using
`import * as runtime from '@strays/runtime'` builds successfully and
the resulting bundle calls `createLogger` with the resolved owner.

---

## 5. Trade-offs and risks

### Performance

`ts-morph` parses ~10× slower than a regex `.replace`. For a
medium-sized `@strays`-using app (~2000 source files), the extra
parse cost on the regex path is roughly 200–500 ms.

But: **`extract.ts` already pays this cost today.** Every file
already goes through `Project.createSourceFile`. Option A doesn't add
a new parse — it removes the *redundant* regex pass that ran *after*
the parse. Net runtime cost is approximately *zero or slightly
negative*. The transform-on-the-AST step is a structural walk over a
tree that's already in memory.

For non-build-time consumers (`generateCodeowners`, `generateManifest`),
nothing changes — they were already paying for `ts-morph`.

The one real cost is bundle size of `@strays/build` itself if any
consumer pulls it in at runtime. Spot-check: it's a build-time
package, peer-depending on `esbuild`. No runtime concern.

### Build dependency: which AST parser?

`extract.ts` already uses **`ts-morph` 24.0.0** (declared in
`packages/build/package.json` dependencies, alongside `picomatch` and
the workspace pointer to `@strays/core`). The constraint is "use
whichever parser `extract.ts` is already using — don't introduce a
new dep", so the answer is `ts-morph`.

`ts-morph` is the right choice for *this* package even on its merits:

- It's a high-level wrapper over the TypeScript compiler API. The
  ergonomics matter for a transform-with-mutation pass — `@swc/core`
  and `oxc-parser` are read-mostly.
- It exposes `SourceFile.insertStatements`,
  `ImportDeclaration.removeNamedImports`,
  `SourceFile.getFullText()` — exactly the surface this design needs.
- It already handles directive prologues (`"use strict"` /
  `"use client"`) as first-class statement classifications, which
  collapses `injectOwnerConstant.ts`'s regex into a constant-time
  index lookup.

Risks with `ts-morph`:

- TypeScript-version sensitivity. `ts-morph` pins a TS version. If
  the consumer project uses bleeding-edge TS syntax that `ts-morph`'s
  pinned compiler doesn't recognise, it'll mis-parse. Mitigation: this
  is already a risk today via `extract.ts`; the design doesn't
  worsen it.
- Transform fidelity. `ts-morph`'s emitter rewrites whitespace and
  quote style. Source maps and stack traces from the rewritten file
  will point to lines that look like the original but aren't
  byte-identical. Mitigation: emit via `SourceFile.replaceWithText`
  on a copy and only rewrite the regions that actually changed,
  preserving everything else as a string slice. (This is a v2
  optimisation — initial implementation can let `ts-morph` reformat.)

### Risk: migrating consumers

`generateCodeowners.ts` imports `extractFromSourceText` from
`./extract.ts`. Renaming the source file breaks this import. The
design preserves the **export name** (`extractFromSourceText`) and
moves it to `./analyzeSourceFile.ts`; consumers update their import
path in a single mechanical change. The `package.json#exports` map
also drops the `./extract`, `./injectOwnerConstant`, and
`./transformLoggerImports` entries — any external consumer would
need to update, but inside this monorepo the only cross-package
consumer is the esbuild plugin and the codeowners/manifest generators,
all of which we own.

### Risk: closure-over-`SourceFile` lifetime

`AnalyzedFile.transform` captures the parsed `SourceFile`. If a caller
holds onto an `AnalyzedFile` for a long time, the `Project`
in-memory file system holds memory. For the esbuild plugin this is a
non-issue — the `AnalyzedFile` is consumed and discarded inside one
`onLoad` call. For the manifest/codeowners generators, the
`extractFromSourceText` overload returns the read-only
`FileExtraction` shape, no closure, so the AST is GC'd after each
call.

### Risk: not deepening enough

A weaker version of (A) would keep `transformLoggerImports.ts` as a
separate file but switch its internals from regex to AST. That
"refactor in place" is tempting because it's smaller, but it leaves
the *interface* shallow: callers still have to remember to call
`extractFromSourceText` AND `transformLoggerImports` AND
`injectOwnerConstant` in the right order, parsing the same file
three times. The whole point is to absorb that orchestration into the
module. So: rename and merge, don't refactor in place.
