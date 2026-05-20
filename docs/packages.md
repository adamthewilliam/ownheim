# Package reference

Install `@ownheim/core` first, then add only the adapters your project needs.

| Package | Purpose |
|---|---|
| `@ownheim/core` | Configuration helpers, ownership scope propagation, `OwnedError`, manifest registration, logging and tracing primitives |
| `@ownheim/cli` | `ownheim generate`, `check`, and `coverage` commands |
| `@ownheim/build` | Source analysis, artifact generation helpers, and esbuild plugin |
| `@ownheim/express` | Express entrypoint owner middleware |
| `@ownheim/hono` | Hono entrypoint owner middleware |
| `@ownheim/trpc` | tRPC entrypoint owner middleware and owned procedure helper |
| `@ownheim/orpc` | oRPC entrypoint owner middleware and owned procedure helper |
| `@ownheim/datadog` | Datadog tracer and RUM ownership integration |
| `@ownheim/otel` | OpenTelemetry span processor and resource decoration |
| `@ownheim/pino` | Pino mixin for ownership fields |
| `@ownheim/sentry` | Sentry event processor and CODEOWNERS sync helper |
| `@ownheim/effect` | Effect ownership tag, `ownedBy`, logger, and tracer helpers |
| `@ownheim/eslint` | ESLint rules for ownership policy enforcement |
| `@ownheim/oxlint` | Oxlint rules for ownership policy enforcement |

## Typical installs

### Minimal config and CI

```bash
bun add @ownheim/core @ownheim/cli
```

### API service with Express and Pino

```bash
bun add @ownheim/core @ownheim/cli @ownheim/express @ownheim/pino
```

### Service with OpenTelemetry

```bash
bun add @ownheim/core @ownheim/cli @ownheim/otel
```

### Monorepo with lint enforcement

```bash
bun add @ownheim/core @ownheim/cli @ownheim/eslint
```

Use `@ownheim/oxlint` instead if your project standardizes on Oxlint.

## Tree-shaking guidance

Ownheim packages are ESM-first and publish subpath exports. In bundle-sensitive code, import the exact module instead of a package root:

```ts
import { OwnedError } from '@ownheim/core/OwnedError';
import { runWithEntrypointOwner } from '@ownheim/core/ownership';
import { ownershipMixin } from '@ownheim/pino/mixin';
import { generateCodeowners } from '@ownheim/build/generateCodeowners';
```

Root imports are supported, but they are best for CLI, Node tooling, tests, and examples where convenience matters more than the smallest possible bundle. Subpath imports avoid accidentally traversing broader barrels such as `@ownheim/core` or the `ts-morph`-backed `@ownheim/build` root.

Use `bun run check:treeshaking` in this repository to compare representative root and subpath bundle outputs.
