# ownheim

> Find a home for every line of code.

Code-first team ownership for TypeScript monorepos. `ownheim.config.ts` is the source of truth for code ownership, generated CODEOWNERS, ownership coverage checks, and ownership-aware telemetry.

Ownheim emits explicit ownership layers instead of one ambiguous `team` field:

| Concept | Meaning | Tag |
|---|---|---|
| Entrypoint owner | Team accountable for the request, job, procedure, event, or command that started this work | `ownheim.entrypoint_team` |
| Code owner | Team accountable for the source file or package emitting telemetry | `ownheim.code_team` |
| Responder | Team best positioned to investigate, mitigate, or remediate a failure | `ownheim.responder_team` |

See [docs/ownership-model.md](./docs/ownership-model.md) for the full terminology guide.

## Installation

```bash
# Core package
bun add @ownheim/core

# With build tooling
bun add @ownheim/core @ownheim/build @ownheim/cli

# Framework integrations
bun add @ownheim/hono
bun add @ownheim/express
bun add @ownheim/trpc
bun add @ownheim/orpc

# Observability integrations
bun add @ownheim/datadog
bun add @ownheim/pino
bun add @ownheim/sentry
bun add @ownheim/otel
```

> These packages export TypeScript source files directly and require a bundler with TypeScript support (Bun, esbuild, Vite, etc.) or `allowImportingTsExtensions` in your tsconfig.

## Packages

| Package | Purpose |
|---|---|
| `@ownheim/core` | `defineOwnheim`, `OwnedError`, `runWithEntrypointOwner`, `registerOwnershipManifest`, logger/tracer factories |
| `@ownheim/build` | esbuild plugin + AST extractor |
| `@ownheim/cli` | `ownheim generate \| check \| coverage \| trace \| diff` |
| `@ownheim/trpc` | tRPC entrypoint ownership helpers |
| `@ownheim/orpc` | oRPC entrypoint ownership helpers |
| `@ownheim/hono` | Hono entrypoint ownership middleware |
| `@ownheim/express` | Express entrypoint ownership middleware |
| `@ownheim/datadog` | dd-trace + RUM integration |
| `@ownheim/pino` | Pino ownership mixin |
| `@ownheim/sentry` | Sentry event processor + CODEOWNERS sync |
| `@ownheim/otel` | OpenTelemetry SpanProcessor |

## Quick start

```ts
// ownheim.config.ts
import { defineOwnheim } from '@ownheim/core';

export default defineOwnheim({
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

Load the generated ownership manifest once at process startup so Ownheim can resolve code ownership from stack frames:

```ts
import manifest from './.ownheim/ownership.json' with { type: 'json' };
import { registerOwnershipManifest } from '@ownheim/core';

registerOwnershipManifest(manifest);
```

Instrument telemetry:

```ts
import tracer from 'dd-trace';
import { instrumentDatadog } from '@ownheim/datadog';

tracer.init({ service: 'api' });
instrumentDatadog(tracer);
```

Mark entrypoints explicitly:

```ts
import { entrypointOwner } from '@ownheim/express';

app.use('/api/accounts', entrypointOwner('Accounts'));
```

Annotate cross-team failures with the team that should respond:

```ts
import { OwnedError } from '@ownheim/core';

throw new OwnedError('Ledger write failed', {
  responderTeam: 'Billing',
});
```

Telemetry for an Accounts request that fails inside Billing-owned code can now carry all relevant context:

```json
{
  "ownheim.entrypoint_team": "Accounts",
  "ownheim.code_team": "Billing",
  "ownheim.responder_team": "Billing"
}
```

## Examples

- [`examples/turborepo-monorepo`](./examples/turborepo-monorepo) — generated CODEOWNERS and manifest in a Turborepo-style workspace.
- [`examples/bun-effect-http`](./examples/bun-effect-http) — Bun HTTP service with Effect-oriented ownership helpers.
- [`examples/express-pino-sentry`](./examples/express-pino-sentry) — Express route owners with Pino log fields and Sentry event tags.
- [`examples/trpc-api`](./examples/trpc-api) — owner-tagged tRPC procedure builders.
- [`examples/hono-otel`](./examples/hono-otel) — Hono prefix owners with OpenTelemetry span attributes.

## License

MIT
