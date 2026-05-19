# Express + Pino + Sentry example

Shows route-level entrypoint ownership with `@ownheim/express`, structured log fields with `@ownheim/pino`, and Sentry event tagging with `@ownheim/sentry`.

```bash
bun install
bun run generate
bun run start
```

Try:

```bash
curl -X POST localhost:3000/api/billing/charge -H 'content-type: application/json' -d '{"amount":25}'
curl localhost:3000/api/identity/me
```

The second request intentionally fails without an `authorization` header and logs ownership fields for the entrypoint, code owner, and responder.
