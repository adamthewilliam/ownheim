# strays

> Find a home for every line of code.

Code-first team ownership for TypeScript. A single source-of-truth annotation in code drives:

- **`.github/CODEOWNERS`** — generated from your `strays.config.ts`, never hand-edited
- **Datadog / Sentry / OpenTelemetry** — every span, log, and error tagged with the owning team
- **Lint enforcement** — oxlint and eslint rules that flag any unowned (stray) file

The library's name is the metric you want at zero. `strays.count` is the number of unowned files; `strays check` fails when it's non-zero.

## Installation

```bash
# Core package
bun add @strays/core

# With build tooling
bun add @strays/core @strays/build @strays/cli

# Framework integrations (pick what you use)
bun add @strays/hono      # Hono
bun add @strays/express   # Express
bun add @strays/trpc      # tRPC
bun add @strays/orpc      # oRPC
bun add @strays/effect    # Effect-TS

# Observability integrations
bun add @strays/datadog   # Datadog
bun add @strays/sentry    # Sentry
bun add @strays/otel      # OpenTelemetry
```

> **Note:** These packages export TypeScript source files directly and require a bundler with TypeScript support (Bun, esbuild, Vite, etc.) or `allowImportingTsExtensions` in your tsconfig.

## Packages

| Package | Purpose |
|---|---|
| `@strays/core` | `defineStrays`, `OwnedError`, `runWithOwner`, `currentOwner`, logger/tracer factories |
| `@strays/effect` | Effect-TS `Owner` Context.Tag, `ownedBy` decorator, Layers |
| `@strays/build` | esbuild plugin + AST extractor |
| `@strays/cli` | `strays generate \| check \| coverage \| trace \| diff` |
| `@strays/trpc` | tRPC procedure middleware (`ownedProcedure`, `ownerMiddleware`) |
| `@strays/orpc` | oRPC procedure middleware (`ownedProcedure`, `ownerMiddleware`) |
| `@strays/hono` | Hono per-route / per-prefix middleware (`ownerMiddleware`) |
| `@strays/express` | Express per-route / per-router middleware (`ownerMiddleware`) |
| `@strays/datadog` | dd-trace + RUM integration |
| `@strays/sentry` | Sentry event processor + CODEOWNERS sync |
| `@strays/otel` | OpenTelemetry SpanProcessor |
| `@strays/lint-core` | Linter-agnostic rule logic |
| `@strays/oxlint` | oxlint custom plugin (primary) |
| `@strays/eslint` | eslint plugin (fallback) |

## Quick start

```ts
// strays.config.ts
import { defineStrays } from '@strays/core';

export default defineStrays({
  owners: {
    Billing: { github: '@org/billing', pagerduty: 'billing-primary', tier: 1 },
  },
  rules: [
    { glob: 'packages/billing/**', owner: 'Billing' },
    { glob: '**', owner: 'Billing', fallback: true },
  ],
});
```

```ts
// at HTTP entry point
import { runWithOwner } from '@strays/core/ownership';

app.use((req, _res, next) => {
  runWithOwner(routeOwnerFor(req.path), () => next());
});
```

That's it. Logs, spans, and errors emitted inside the scope carry `team=billing` automatically.

## License

MIT
