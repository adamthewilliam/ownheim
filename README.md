# ownheim

> Find a home for every line of code.

Code-first team ownership for TypeScript monorepos. Ownheim uses `ownheim.config.ts` as the source of truth for generated `CODEOWNERS`, ownership coverage checks, and ownership-aware telemetry.

## Install

Install the core package plus the adapters you need:

```bash
bun add @ownheim/core @ownheim/cli

# Optional build-time support
bun add @ownheim/build

# Optional framework adapters
bun add @ownheim/express @ownheim/hono @ownheim/trpc @ownheim/orpc

# Optional observability adapters
bun add @ownheim/datadog @ownheim/otel @ownheim/pino @ownheim/sentry

# Optional lint adapters
bun add @ownheim/eslint @ownheim/oxlint
```

> Ownheim packages are ESM-first TypeScript packages. Use a TypeScript-aware runtime/bundler such as Bun, Vite, esbuild, tsdown, or enable TypeScript import support in your project.

## Setup

Create `ownheim.config.ts` at the root of your repository:

```ts
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

Generate ownership artifacts:

```bash
bunx ownheim generate
```

Add checks to CI:

```bash
bunx ownheim check
bunx ownheim coverage
```

Register the generated runtime manifest once during application startup:

```ts
import { registerOwnershipManifest } from '@ownheim/core';
import manifest from './.ownheim/ownership.json' with { type: 'json' };

registerOwnershipManifest(manifest);
```

## Learn more

- [Getting started](./docs/getting-started.md)
- [Ownership model](./docs/ownership-model.md)
- [Configuration guide](./docs/configuration.md)
- [Runtime instrumentation](./docs/runtime-instrumentation.md)
- [Package reference](./docs/packages.md)
- [Examples](./docs/examples.md)

## License

MIT
