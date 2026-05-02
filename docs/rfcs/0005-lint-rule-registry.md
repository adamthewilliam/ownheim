# Deepening the Lint Adapter Module

> Following Ousterhout's *A Philosophy of Software Design*: deepen `@strays/lint-core` so each adapter package becomes a thin shell. Adding a rule should be a one-file edit in `lint-core`.

---

## 1. Problem statement

The lint subsystem is split into three packages:

- `@strays/lint-core` — adapter shape + rule logic.
- `@strays/oxlint` — oxlint plugin shell.
- `@strays/eslint` — eslint plugin shell.

The adapter abstraction itself is well-shaped:

```ts
// packages/lint-core/src/adapter.ts
export interface LintAdapter<TContext> {
  readonly getFilename: (ctx: TContext) => string;
  readonly getSourceText: (ctx: TContext) => string;
  readonly getOptions: <TOptions>(ctx: TContext) => TOptions | undefined;
  readonly report: (ctx: TContext, diagnostic: Diagnostic) => void;
}

export const runRule = <TContext, TOptions>(
  adapter: LintAdapter<TContext>,
  definition: LintRuleDefinition<TOptions>,
  context: TContext,
): void => { ... };
```

The duplication lives **one layer up**, in the per-rule wrapper files. Both adapter packages own a `rules/` directory whose files are mirror images:

```ts
// packages/oxlint/src/rules/no-strays.ts
export const noStraysRule: OxlintRule = {
  meta: { type: 'problem', description: '...', fixable: 'code' },
  create(context) {
    return {
      Program: () => runRule<typeof context, LintRuleOptions>(oxlintAdapter, logic, context),
    };
  },
};
```

```ts
// packages/eslint/src/rules/no-strays.ts
export const noStraysRule: EslintRule = {
  meta: {
    type: 'problem',
    docs: { description: '...' },
    fixable: 'code',
    schema: [{ type: 'object', properties: { config: { type: 'object' } }, ... }],
  },
  create(context) {
    return {
      Program: () => runRule<typeof context, LintRuleOptions>(eslintAdapter, logic, context),
    };
  },
};
```

Both `create()` bodies are byte-for-byte the same modulo the adapter symbol. The metadata shape differs (oxlint uses `description` flat, eslint nests under `docs` and adds `schema`), but every rule needs **both** representations. The `plugin.ts` files then hand-list each wrapper:

```ts
// packages/oxlint/src/plugin.ts AND packages/eslint/src/plugin.ts
import { noStraysRule } from './rules/no-strays.ts';
import { noCodeownersEditRule } from './rules/no-codeowners-edit.ts';

export const plugin = { rules: { 'no-strays': noStraysRule, 'no-codeowners-edit': ... } };
```

**Cost of adding a 3rd rule today:** edit five files — `lint-core/rules/noUntypedOwner.ts`, `oxlint/rules/no-untyped-owner.ts`, `oxlint/plugin.ts`, `eslint/rules/no-untyped-owner.ts`, `eslint/plugin.ts`. Four of those edits are pure ceremony.

The adapter abstraction is shallow because it stops at *one rule run*. Everything above that — the rule catalog, the meta map, the plugin assembly — is re-implemented per adapter.

---

## 2. Candidate interfaces

### A. Auto-registration via a Rule[] registry

`lint-core` exports a flat `rules` array. Each rule entry carries `id`, `validate`, and adapter-neutral meta hints. Each adapter package iterates the registry once and produces its plugin's `rules` map.

```ts
// lint-core
export const rules: ReadonlyArray<RegisteredRule> = [noStraysRule, noCodeownersEditRule];
```

```ts
// oxlint/plugin.ts (entire file)
import { rules } from '@strays/lint-core/rules';
import { toOxlintRule } from './toOxlintRule.ts';
export const plugin = {
  name: '@strays/oxlint',
  meta: { name: '@strays', version: '0.1.0' },
  rules: Object.fromEntries(rules.map((r) => [r.id, toOxlintRule(r)])),
};
```

- Pros: zero per-rule files in adapter packages. Adding a rule = one file in `lint-core`.
- Cons: requires meta to be expressible adapter-agnostically (or as a tagged union) so `toOxlintRule` / `toEslintRule` can fan out.

### B. Plugin factory

`lint-core` exports `createPlugin(adapter, options)` that builds the entire plugin object. Each adapter package supplies (1) its `LintAdapter`, (2) a per-adapter rule-shape projector, and (3) a name. The plugin file shrinks to ~5 lines.

```ts
// oxlint/plugin.ts
import { createPlugin } from '@strays/lint-core/createPlugin';
import { oxlintAdapter, projectOxlintRule } from './adapter.ts';
export const plugin = createPlugin({
  name: '@strays/oxlint',
  adapter: oxlintAdapter,
  project: projectOxlintRule,
});
```

- Pros: same shrinkage as A, but explicit factory call sites (easier to grep/typecheck per adapter).
- Cons: the adapter still has to ship a "projector" function, which is essentially A's `toOxlintRule` plus a function around it. Slightly more API surface than A.

### C. Adapter-driven dispatch via `runRule(adapter, ruleId, ctx)`

The adapter's per-rule wrapper becomes a one-liner that delegates by id. The wrapper files survive but become trivial.

```ts
// oxlint/rules/no-strays.ts
export const noStraysRule: OxlintRule = {
  meta: { ...oxlintMetaFor('no-strays') },
  create: (ctx) => ({ Program: () => runRule(oxlintAdapter, 'no-strays', ctx) }),
};
```

- Pros: smallest change; rule logic still hidden.
- Cons: per-rule files in oxlint/eslint do **not** vanish — the central friction the user named. Doesn't deepen the module enough.

---

## 3. Recommended design — Auto-registration (variant A, with a small projector)

Pick **A**, lightly augmented with an explicit `project` step (the useful half of B). This collapses both adapter packages to two files each (`adapter.ts` + `plugin.ts`), and makes "add a rule" a one-file change in `lint-core`.

### 3.1 Final shape of `@strays/lint-core`

New file `packages/lint-core/src/rules/registry.ts`:

```ts
import type { LintRuleDefinition, LintRuleOptions } from '../adapter.ts';
import { noStraysRule } from './noStrays.ts';
import { noCodeownersEditRule } from './noCodeownersEdit.ts';

/**
 * Adapter-neutral metadata. Each adapter package projects this into its
 * own native rule shape (oxlint flat description, eslint nested docs+schema).
 */
export interface RuleMeta {
  readonly id: string;
  readonly description: string;
  readonly category: 'problem' | 'suggestion';
  readonly fixable: boolean;
  /** JSON-schema-ish shape of options[0], or null when the rule takes no options. */
  readonly optionsSchema: 'lint-rule-options' | null;
}

export interface RegisteredRule<TOptions = LintRuleOptions> {
  readonly meta: RuleMeta;
  readonly definition: LintRuleDefinition<TOptions>;
}

export const rules: ReadonlyArray<RegisteredRule<unknown>> = [
  {
    meta: {
      id: 'no-strays',
      description: 'every source file must resolve to an explicit (non-fallback) owner',
      category: 'problem',
      fixable: true,
      optionsSchema: 'lint-rule-options',
    },
    definition: noStraysRule as LintRuleDefinition<unknown>,
  },
  {
    meta: {
      id: 'no-codeowners-edit',
      description: '.github/CODEOWNERS is generated; do not hand-edit',
      category: 'problem',
      fixable: false,
      optionsSchema: null,
    },
    definition: noCodeownersEditRule as LintRuleDefinition<unknown>,
  },
];
```

`adapter.ts`, `validateFileOwnership.ts`, `validateCodeownersEdit.ts`, `types.ts`, and the `rules/no*.ts` validator-only modules are **unchanged**. `runRule` stays — adapters still call it per program-visit.

No barrel exports: consumers `import { rules } from '@strays/lint-core/rules/registry'` directly.

### 3.2 Final shape of `@strays/oxlint` — 2 files

`packages/oxlint/src/adapter.ts` — unchanged plus one new export `projectOxlintRule(rule: RegisteredRule): OxlintRule`:

```ts
export const projectOxlintRule = (r: RegisteredRule): OxlintRule => ({
  meta: {
    type: r.meta.category,
    description: r.meta.description,
    ...(r.meta.fixable ? { fixable: 'code' as const } : {}),
  },
  create: (ctx) => ({
    Program: () => runRule(oxlintAdapter, r.definition, ctx),
  }),
});
```

`packages/oxlint/src/plugin.ts` — entire file:

```ts
import { rules } from '@strays/lint-core/rules/registry';
import { projectOxlintRule } from './adapter.ts';

export const plugin = {
  name: '@strays/oxlint',
  meta: { name: '@strays', version: '0.1.0' },
  rules: Object.fromEntries(rules.map((r) => [r.meta.id, projectOxlintRule(r)])),
} as const;

export default plugin;
```

The `packages/oxlint/src/rules/` directory is **deleted**.

### 3.3 Final shape of `@strays/eslint` — 2 files

Same shape, different projector. `projectEslintRule` produces the nested `docs.description`, attaches `fixable: 'code'` only when `r.meta.fixable`, and emits the `schema` array based on `r.meta.optionsSchema` (a tiny lookup: `'lint-rule-options'` → the standard `{ config: object }` schema; `null` → `[]`).

```ts
export const projectEslintRule = (r: RegisteredRule): EslintRule => ({
  meta: {
    type: r.meta.category,
    docs: { description: r.meta.description },
    ...(r.meta.fixable ? { fixable: 'code' as const } : {}),
    schema: schemaFor(r.meta.optionsSchema),
  },
  create: (ctx) => ({ Program: () => runRule(eslintAdapter, r.definition, ctx) }),
});
```

`plugin.ts` mirrors oxlint's:

```ts
import { rules } from '@strays/lint-core/rules/registry';
import { projectEslintRule } from './adapter.ts';

export const plugin = {
  meta: { name: '@strays/eslint', version: '0.1.0' },
  rules: Object.fromEntries(rules.map((r) => [r.meta.id, projectEslintRule(r)])),
} as const;

export default plugin;
```

`packages/eslint/src/rules/` is **deleted**.

### 3.4 Adding a 3rd rule (`no-untyped-owner`)

One file added in `lint-core` and one entry appended:

1. Create `packages/lint-core/src/rules/noUntypedOwner.ts` with the validator (matches the `validateX` + `LintRuleDefinition` pattern already used).
2. Append to `rules` in `registry.ts`:
   ```ts
   {
     meta: { id: 'no-untyped-owner', description: '...', category: 'problem', fixable: false, optionsSchema: 'lint-rule-options' },
     definition: noUntypedOwnerRule,
   },
   ```

That's it. Both `@strays/oxlint` and `@strays/eslint` pick the rule up automatically on next build — zero edits in either adapter package.

### 3.5 Where adapter-specific differences live

- **Quick-access vs classic context** — encapsulated entirely inside the existing `oxlintAdapter` / `eslintAdapter` `LintAdapter<TContext>` implementations (`getFilename` reads `ctx.filename` vs calls `ctx.getFilename()`). No change.
- **Native rule shape** (flat description vs nested docs, fixable boolean vs `'code'` literal, schema array vs absent) — encapsulated in `projectOxlintRule` and `projectEslintRule`. The adapter-neutral `RuleMeta` is the seam: it carries only the *information* needed; each projector decides the *shape*.
- **Future per-adapter quirks** (e.g. eslint-only `messages` table, oxlint-only `category` field) — extend `RuleMeta` with one more adapter-neutral field (e.g. `messageId?: string`) and update both projectors. Still a one-file change in `lint-core` plus the projectors.

---

## 4. Test strategy

### 4.1 New tests (boundary-focused)

**`packages/lint-core/src/rules/registry.test.ts`** — pure data:
- Every `RegisteredRule.meta.id` is unique.
- Every entry's `definition.validate` is callable and returns `Diagnostic[]`.
- `rules` length matches the count of validator modules (guards against forgetting to register).

**`packages/oxlint/src/projectOxlintRule.test.ts`**:
- For each rule in `rules`, `projectOxlintRule(r)` produces a valid `OxlintRule` (correct `meta.type`, `description`, `fixable` presence matches `r.meta.fixable`).
- A single end-to-end test: stand up a fake `OxlintRuleContext`, invoke `Program()`, assert that diagnostics from `validateFileOwnership` / `validateCodeownersEdit` propagate.

**`packages/eslint/src/projectEslintRule.test.ts`** — symmetrical: verifies `meta.docs.description`, `schema` shape per `optionsSchema`, and one end-to-end Program() invocation.

**`packages/{oxlint,eslint}/src/plugin.test.ts`** — keep, but reduce to two assertions each: (1) `plugin.rules` keys equal the set of registry ids, (2) one smoke-test rule fires correctly. The exhaustive per-rule diagnostic equivalence already lives in lint-core's `validateFileOwnership.test.ts` / `validateCodeownersEdit.test.ts`.

### 4.2 Tests that get deleted

- `packages/oxlint/src/rules/*.test.ts` — none exist today, but any future per-rule test stubs are obviated.
- The "exposes both rules" assertions in the existing `plugin.test.ts` collapse into a single registry-id parity check.
- The `eslint/plugin.test.ts` "produces the same N diagnostics as lint-core for each fixture" loop becomes redundant once `projectEslintRule` has its end-to-end test, because the fixture iteration is now testing the validator (already covered in lint-core) plus the projector (covered above). Keep one fixture as a smoke test, drop the rest.

Net: ~50 lines of mirror tests deleted, ~30 lines of boundary tests added.

---

## 5. Trade-offs and risks

**Wins**
- Module deepens: `lint-core` now owns "what rules exist + what they mean" entirely. Adapter packages own "how this linter speaks". The seam is `RuleMeta`, which is small and obvious.
- Adding a rule: 1 file in `lint-core` (validator) + 1 line in `registry.ts`. Zero edits in adapter packages.
- Plugin assembly is data-driven, so a typo in a rule id can no longer cause oxlint and eslint to drift apart.
- Three-package surface preserved: users still install `@strays/oxlint` or `@strays/eslint` and get a real plugin.

**Costs**
- `RuleMeta` introduces a small adapter-neutral vocabulary (`category`, `fixable`, `optionsSchema`). Every new adapter-specific knob requires extending it. The risk is that `RuleMeta` slowly grows into a kitchen-sink type — mitigated by keeping the field set tightly scoped to *information* (boolean, ids, descriptions), never *shapes*.
- `optionsSchema: 'lint-rule-options' | null` is a tagged enum-ish lookup, not arbitrary JSON Schema. If a future rule needs a custom options shape (e.g. `no-untyped-owner` accepts a `severity` enum), the enum grows. Acceptable for now; a richer schema model can replace the tag without touching adapters.
- Type erasure: `rules` is typed `ReadonlyArray<RegisteredRule<unknown>>` because rules carry different `TOptions`. The cast happens once, at registry construction. `runRule` is already generic, so the call site stays sound — but a wrong cast in `registry.ts` only fails at runtime.
- Slightly more abstract for first-time readers: instead of "open `rules/no-strays.ts` to see the rule", you open `registry.ts` to see *all* rules. This is a wash — Ousterhout would call it "information localized in one place".

**Risks**
- Plugin shape drift: oxlint or eslint may add fields to their plugin/rule contracts in future versions. Because both projectors are tiny and centralized, the fix is one edit per adapter — strictly better than today, where it would be N edits per rule.
- Test coverage illusion: deleting per-rule mirror tests assumes the projector tests + lint-core validator tests are exhaustive. Mitigation: keep the one-rule smoke test in each `plugin.test.ts` as a tripwire.
