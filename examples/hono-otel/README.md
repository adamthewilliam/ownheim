# Hono + OpenTelemetry example

Shows prefix-level entrypoint ownership with `@ownheim/hono` and span attributes from `@ownheim/otel`.

```bash
bun install
bun run generate
bun run start
```

Try:

```bash
curl -X POST localhost:3000/api/billing/checkout -H 'content-type: application/json' -d '{"amount":25}'
curl localhost:3000/api/identity/me
```

The console span exporter prints spans decorated with Ownheim ownership attributes such as `ownheim.entrypoint_team` and `ownheim.code_team`.
