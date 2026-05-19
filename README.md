# strays

> Find a home for every line of code.

Code-first team ownership for TypeScript monorepos. `strays.config.ts` is the source of truth for code ownership, generated CODEOWNERS, ownership coverage checks, and ownership-aware telemetry.

Strays emits explicit ownership layers instead of one ambiguous `team` field:

| Concept | Meaning | Tag |
|---|---|---|
| Entrypoint owner | Team accountable for the request, job, procedure, event, or command that started this work | `strays.entrypoint_team` |
| Code owner | Team accountable for the source file or package emitting telemetry | `strays.code_team` |
| Responder | Team best positioned to investigate, mitigate, or remediate a failure | `strays.responder_team` |

See [docs/ownership-model.md](./docs/ownership-model.md) for the full terminology guide.

## Installation

```bash
# Core package
bun add @strays/core

# With build tooling
bun add @strays/core @strays/build @strays/cli

# Framework integrations
bun add @strays/hono
bun add @strays/express
bun add @strays/trpc
bun add @strays/orpc

# Observability integrations
bun add @strays/datadog
bun add @strays/pino
bun add @strays/sentry
bun add @strays/otel
```

> These packages export TypeScript source files directly and require a bundler with TypeScript support (Bun, esbuild, Vite, etc.) or `allowImportingTsExtensions` in your tsconfig.

## Packages

| Package | Purpose |
|---|---|
| `@strays/core` | `defineStrays`, `OwnedError`, `runWithEntrypointOwner`, `registerOwnershipManifest`, logger/tracer factories |
| `@strays/build` | esbuild plugin + AST extractor |
| `@strays/cli` | `strays generate \| check \| coverage \| trace \| diff` |
| `@strays/trpc` | tRPC entrypoint ownership helpers |
| `@strays/orpc` | oRPC entrypoint ownership helpers |
| `@strays/hono` | Hono entrypoint ownership middleware |
| `@strays/express` | Express entrypoint ownership middleware |
| `@strays/datadog` | dd-trace + RUM integration |
| `@strays/pino` | Pino ownership mixin |
| `@strays/sentry` | Sentry event processor + CODEOWNERS sync |
| `@strays/otel` | OpenTelemetry SpanProcessor |

## Quick start

```ts
// strays.config.ts
import { defineStrays } from '@strays/core';

export default defineStrays({
  teams: {
    Accounts: {
      github: '@org/accounts',
      owns: ['packages/accounts/**'],
    },
    Billing: {
      github: '@org/billing',
      owns: ['packages/billing/**'],
    },
  },
});
```

Load the generated ownership manifest once at process startup so Strays can resolve code ownership from stack frames:

```ts
import manifest from './.strays/ownership.json' with { type: 'json' };
import { registerOwnershipManifest } from '@strays/core';

registerOwnershipManifest(manifest);
```

Instrument telemetry:

```ts
import tracer from 'dd-trace';
import { instrumentDatadog } from '@strays/datadog';

tracer.init({ service: 'api' });
instrumentDatadog(tracer);
```

Mark entrypoints explicitly:

```ts
import { entrypointOwner } from '@strays/express';

app.use('/api/accounts', entrypointOwner('Accounts'));
```

Annotate cross-team failures with the team that should respond:

```ts
import { OwnedError } from '@strays/core';

throw new OwnedError('Ledger write failed', {
  responderTeam: 'Billing',
});
```

Telemetry for an Accounts request that fails inside Billing-owned code can now carry all relevant context:

```json
{
  "strays.entrypoint_team": "Accounts",
  "strays.code_team": "Billing",
  "strays.responder_team": "Billing"
}
```

## License

MIT
