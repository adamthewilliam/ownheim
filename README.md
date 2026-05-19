<p align="center">
  <img src="docs/assets/ownheim-logo.png" alt="Ownheim logo" width="420" />
</p>

<h1 align="center">ownheim</h1>

<p align="center">
  <strong>Find a home for every line of code.</strong>
</p>

<p align="center">
  Code-first team ownership for TypeScript monorepos — generate <code>CODEOWNERS</code>, enforce coverage, and attach ownership context to runtime telemetry.
</p>

<p align="center">
  <a href="./LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-111827.svg" /></a>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-first-3178c6.svg" />
  <img alt="Runtime: Bun" src="https://img.shields.io/badge/runtime-Bun-f9f1e1.svg" />
  <img alt="ESM" src="https://img.shields.io/badge/modules-ESM-7c3aed.svg" />
</p>

---

## Why Ownheim?

Ownership metadata usually drifts: `CODEOWNERS` gets stale, services emit logs without team context, and no one knows who owns an unclaimed folder until something breaks.

Ownheim makes ownership a typed, reviewable part of your repository:

- **One source of truth** — define ownership once in `ownheim.config.ts`.
- **Generated artifacts** — produce `CODEOWNERS` and runtime ownership manifests.
- **CI-friendly enforcement** — check ownership coverage before drift lands.
- **Runtime context** — tag logs, traces, errors, and framework routes with the owning team.
- **Monorepo-ready** — designed for TypeScript workspaces with many packages and adapters.

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

## Quick start

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

## Packages

| Package | Purpose |
| --- | --- |
| `@ownheim/core` | Ownership resolution, scope propagation, logging, and tracing primitives. |
| `@ownheim/cli` | `generate`, `check`, `coverage`, `trace`, and `diff` commands. |
| `@ownheim/build` | AST walker, rule resolver, generators, and esbuild plugin. |
| `@ownheim/express` / `@ownheim/hono` | Framework middleware for per-route team tagging. |
| `@ownheim/trpc` / `@ownheim/orpc` | Procedure middleware for ownership-aware RPC telemetry. |
| `@ownheim/pino` / `@ownheim/otel` | Logging and OpenTelemetry ownership adapters. |
| `@ownheim/datadog` / `@ownheim/sentry` | Vendor integrations for team-tagged monitoring. |
| `@ownheim/eslint` / `@ownheim/oxlint` | Rules that prevent ownership drift and manual `CODEOWNERS` edits. |
| `@ownheim/effect` | Effect-TS owner context, decorators, logger, and tracer layers. |

## Learn more

- [Getting started](./docs/getting-started.md)
- [Ownership model](./docs/ownership-model.md)
- [Configuration guide](./docs/configuration.md)
- [Runtime instrumentation](./docs/runtime-instrumentation.md)
- [Package reference](./docs/packages.md)
- [Examples](./docs/examples.md)

## License

MIT
