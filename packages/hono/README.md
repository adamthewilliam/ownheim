# @ownheim/hono

Tag every Hono route with the team that owns it.

This is a Hono middleware. It wraps the rest of the request chain in a `runWithEntrypointOwner` scope so any span, log, or error emitted while the route handler runs is tagged with the right entrypoint team automatically.

## Install

```bash
bun add @ownheim/hono @ownheim/core
```

You also need `hono`. Ownheim doesn't pin a version. Anything with the standard `(c, next)` middleware shape works.

## Per-route

```ts
import { Hono } from 'hono';
import { entrypointOwner } from '@ownheim/hono';

const app = new Hono();

app.post('/charge', entrypointOwner('Billing'), chargeHandler);
app.get('/users/:id', entrypointOwner('Identity'), getUserHandler);
```

## Per-prefix

Hono's `app.use(path, mw)` already does path-based mounting, so you don't need a separate API for it:

```ts
app.use('/api/billing/*', entrypointOwner('Billing'));
app.use('/api/identity/*', entrypointOwner('Identity'));

// Routes mounted underneath these prefixes inherit the owner automatically.
app.post('/api/billing/charge', chargeHandler);
app.get('/api/identity/me', meHandler);
```

This is the cleanest setup if your URL structure already mirrors ownership.

## What the middleware actually does

```ts
(_c, next) => runWithEntrypointOwner(owner, () => next());
```

That's it. AsyncLocalStorage holds the owner for the duration of `next()` and any async work it spawns. Anything downstream calling `currentEntrypointOwner()` — handlers, span processors, Sentry event processors — gets the owner back. On the wire (logs, spans, Sentry tags) it's emitted as `ownheim.entrypoint_team`.

## Pairing with `hono/context-storage`

Hono ships its own AsyncLocalStorage helper (`contextStorage()` / `getContext()`) that exposes the request `Context` to code outside the handler call stack. The two work fine together — they use independent ALS instances. If you want both, register `contextStorage()` first:

```ts
import { contextStorage } from 'hono/context-storage';

app.use(contextStorage());
app.use(entrypointOwner('Billing'));
```

Order doesn't really matter for correctness, but registering `contextStorage()` first means it sees every request including ones that get short-circuited by tagged middleware (none of those exist by default, but it's the safer default).

## Pairing with `@ownheim/sentry` and `@ownheim/datadog`

Nothing extra to wire up. Once `instrumentSentry` / `instrumentDatadog` are running, every error and span emitted from a route picks up the owner from the scope:

```
entrypointOwner('Billing')
    → runWithEntrypointOwner('Billing', () => next())
        → handler runs
            → throws or starts a span
                → instrumentSentry / instrumentDatadog reads currentEntrypointOwner()
                    → tag = 'Billing'
```

## Caveats

- The middleware doesn't write to `c.var`. If you want `c.var.team` available inside handlers, set it yourself: `(c, next) => { c.set('team', owner); return runWithEntrypointOwner(owner, () => next()); }`. I left it out to avoid forcing a `Variables` shape on consumers.
- WebSocket and SSE handlers that push outside the request lifecycle aren't covered by the middleware's scope — wrap the push site too if you need tagging there.

## Testing without `hono`

The exported types (`HonoMiddleware`, `HonoNext`) are structural — `c` is typed as `unknown` because the middleware never reads it. Pass any object as `c` and an async function as `next`. The package's own tests do this. See `test/ownerMiddleware.test.ts`.
