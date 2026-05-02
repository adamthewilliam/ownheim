# Deepening glob specificity in `@strays/build`

## 1. Problem statement

Two modules in `@strays/build` ship byte-identical copies of a `specificity(glob: string): number` heuristic — `packages/build/src/resolveRules.ts` (lines 67–82) uses it to pick the best rule for a file, and `packages/build/src/generateCodeowners.ts` (lines 83–96) uses it to order CODEOWNERS entries so that GitHub's last-match-wins semantics agree with our most-specific-wins semantics. The two callers must score patterns the same way or CODEOWNERS will silently disagree with `resolveOwnerForFile`, so the duplication is not just untidy — it is a correctness coupling. The deepening should make that coupling impossible to break by giving both call sites a single, narrow seam.

## 2. Candidate interfaces

### A. Minimal — extract the pure function

```ts
// packages/build/src/globSpecificity.ts
export function globSpecificity(glob: string): number;
```

Both call sites import it and keep their own sort/filter logic. One file, one test, zero behavior change. Shallowest possible deepening.

### B. Broader — a `GlobMatcher` module

```ts
// packages/build/src/globMatcher.ts
export function matches(glob: string, file: string): boolean;
export function specificity(glob: string): number;
export function compareSpecificity(a: string, b: string): number; // -1 / 0 / 1
```

Owns the *entire* concept of "what does a glob mean in strays" — `picomatch` config (`{ dot: true }`), the specificity heuristic, and a canonical comparator. `resolveOwnerForFile` stops calling `picomatch` directly; `generateCodeowners` stops sorting by hand-rolled subtraction.

### C. Rule-oriented — hide matching and specificity behind rule operations

```ts
// packages/build/src/ruleMatching.ts
export function findMostSpecificRule<R extends { glob: string; fallback?: boolean }>(
  rules: readonly R[],
  file: string,
): R | undefined;

export function sortRulesBySpecificityAscending<R extends { glob: string; fallback?: boolean }>(
  rules: readonly R[],
): R[]; // fallback excluded; least-specific first (CODEOWNERS order)
```

Deepest option: callers never see globs at all, only rules. The specificity heuristic, the picomatch call, the fallback-exclusion filter, and the ordering convention all live behind two verbs.

## 3. Recommended design — Option B (`GlobMatcher`)

Option A leaves the duplication risk only half-solved (the `picomatch({ dot: true })` invocation is *also* duplicated implicitly — both call sites must agree on glob semantics, not just specificity). Option C is tempting but couples the module to the `Rule` shape from `@strays/core/types`, and the two callers actually want subtly different rule sets (`resolveOwnerForFile` filters fallback then picks one; `generateCodeowners` sorts non-fallbacks ascending and emits the fallback separately). Forcing them through one rule API would require flags or two near-duplicate functions.

Option B sits at the right depth: it owns the *glob* concept end-to-end without leaking into rule semantics. Both callers stay in charge of their own rule lifecycles but stop hand-rolling glob math.

### Module

- **File:** `packages/build/src/globMatcher.ts` (stays inside `@strays/build`; no consumer outside this package needs glob math today, and `@strays/core` deliberately holds only types).
- **No barrel export** — callers import `from './globMatcher.ts'` directly, consistent with the no-barrel rule.

### Surface

```ts
import picomatch from 'picomatch';

/** True iff `glob` matches `file` under strays' canonical glob semantics (dotfiles included). */
export function matches(glob: string, file: string): boolean;

/**
 * Heuristic score: more literal characters => more specific.
 * Wildcard runs (`*`, `**`, `?`) contribute nothing. Higher = more specific.
 * Stable across releases; callers MUST treat it as opaque and only compare values.
 */
export function specificity(glob: string): number;

/** Comparator usable with Array#sort. Negative => a is less specific than b. */
export function compareSpecificity(a: string, b: string): number;
```

### Usage at each call site

`resolveRules.ts` — pick the most specific match:

```ts
import { matches, compareSpecificity } from './globMatcher.ts';

const best = config.rules
  .filter((r) => !r.fallback)
  .filter((r) => matches(r.glob, input.filePath))
  .sort((a, b) => compareSpecificity(b.glob, a.glob))[0];
```

`generateCodeowners.ts` — order ascending so last-match-wins:

```ts
import { compareSpecificity } from './globMatcher.ts';

const sortedRules = config.rules
  .filter((r) => !r.fallback)
  .slice()
  .sort((a, b) => compareSpecificity(a.glob, b.glob));
```

### Complexity hidden behind the seam

- The character-walk specificity heuristic and its quirks (consecutive `*`/`?` collapse to one wildcard, `**` scores zero, `?` is a wildcard not a literal).
- The `picomatch({ dot: true })` configuration choice — if we ever switch matchers or enable `nocase`, exactly one file changes.
- The contract that *the same scoring function drives both file resolution and CODEOWNERS ordering*, which is the property that keeps GitHub's view of the repo aligned with strays' view.
- Future edge cases (trailing `/`, leading `**/`, brace expansion, negation) get one home.

What is deliberately *not* hidden: the fallback filter, the rule shape, and the sort direction. Those are caller concerns and pulling them in would push the module toward Option C with no payoff for today's two callers.

## 4. Test strategy

### New tests at the boundary — `packages/build/src/globMatcher.test.ts`

- `specificity('**')` < `specificity('packages/x/**')` < `specificity('packages/x/foo.ts')`
- `specificity('packages/*/foo.ts')` < `specificity('packages/x/foo.ts')` (wildcard segments don't count)
- `specificity('a?.ts')` === `specificity('a.ts')` minus one literal (i.e. `?` is wildcard, not literal) — pins the heuristic so accidental rewrites trip a test.
- `specificity('***')` === `specificity('*')` (consecutive wildcards collapse).
- `matches('packages/billing/**', 'packages/billing/admin/x.ts')` true; `matches('packages/billing/**', 'packages/auth/x.ts')` false.
- `matches` honours dotfiles: `matches('**/*.ts', '.config/foo.ts')` true.
- `compareSpecificity` returns a negative number for less-specific-first ordering and is consistent with `specificity` (`Math.sign(compareSpecificity(a, b)) === Math.sign(specificity(a) - specificity(b))`).

### Tests that stay (and now exercise the seam transitively)

- `packages/build/src/resolveRules.test.ts` — keep all seven cases. The "most-specific glob wins" case (`resolveRules.test.ts:37–44`) now indirectly verifies the integration; no rewrite needed.
- `packages/build/src/generateCodeowners.test.ts` — keep all four cases, especially "emits more-specific rules later" (`generateCodeowners.test.ts:30–35`), which is the only existing test that would catch a divergence.

### Tests that get deleted

None. Both existing test files cover behavior, not the private helper, so they survive verbatim. If during implementation we add a unit test for `specificity` *inside* either existing file (we did not), it should be moved into `globMatcher.test.ts`.

## 5. Trade-offs and risks

**Wins**
- Single source of truth for the correctness coupling between resolution and CODEOWNERS ordering.
- Glob-engine swap (e.g. `micromatch`, `minimatch`) is a one-file change.
- The heuristic's quirks become testable in isolation rather than buried in two unrelated test files.

**Costs**
- One more file in `packages/build/src/`. Small; each call site loses ~16 lines so net code shrinks.
- A tiny ceremony tax: callers now `import` three names rather than inlining a helper.

**Risks**
- *Premature generality.* If a third consumer never appears, Option A would have sufficed. Mitigation: Option B's surface is still only three pure functions; we are not building a class, a config object, or a registry.
- *Heuristic drift the module can't catch.* The score is a heuristic — `packages/billing/**` and `packages/b/**/*.ts` can score equal-ish and the module's tests cannot define a "correct" answer for ambiguous cases. Mitigation: pin current observed scores in tests so any change is intentional, and document `specificity` as opaque/unstable across major versions.
- *Cross-package pull.* If `@strays/lint-core` later wants to reason about globs, we will be tempted to hoist this to a shared `@strays/match`. That move is cheap from `packages/build/src/globMatcher.ts` (it's already a pure module with no internal deps) and costly from two duplicated copies — so deepening here makes the future move easier, not harder.
- *Picomatch config leak.* Hard-coding `{ dot: true }` inside `matches` is a behavioral choice the original code already made; we are codifying it. If a caller ever needs different semantics, they will have to extend the module rather than reach around it — which is the point.
