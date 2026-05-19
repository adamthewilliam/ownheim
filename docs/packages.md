# Package reference

Install `@ownheim/core` first, then add only the adapters your project needs.

| Package | Purpose |
|---|---|
| `@ownheim/core` | Configuration helpers, ownership scope propagation, `OwnedError`, manifest registration, logging and tracing primitives |
| `@ownheim/cli` | `ownheim generate`, `check`, `coverage`, and `trace` commands |
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
