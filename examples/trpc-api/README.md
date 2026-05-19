# tRPC API example

Shows reusable owner-tagged procedure builders with `@ownheim/trpc`.

```ts
const billingProcedure = entrypointProcedure(t.procedure, 'Billing');
```

Every resolver built from that procedure runs inside a Billing entrypoint ownership scope. Telemetry integrations that read `currentEntrypointOwner()` can tag logs, spans, and errors automatically.

```bash
bun install
bun run generate
bun run start
```
