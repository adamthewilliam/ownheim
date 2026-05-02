# @strays/hono

Tag every Hono route with the team that owns it.

This is a Hono middleware. It wraps the rest of the request chain in a `runWithOwner` scope so any span, log, or error emitted while the route handler runs is tagged with the right team automatically.

## Install

```bash
bun add @strays/hono @strays/runtime @strays/core
```

You also need `hono`. Strays doesn't pin a version. Anything with the standard `(c, next)` middleware shape works.

## Per-route

```ts
import { Hono } from 'hono';
import { teamMiddleware } from '@strays/hono/teamMiddleware';

const app = new Hono();

app.post('/charge', teamMiddleware('Billing'), chargeHandler);
app.get('/users/:id', teamMiddleware('Identity'), getUserHandler);
```

## Per-prefix

Hono's `app.use(path, mw)` already does path-based mounting, so you don't need a separate API for it:

```ts
app.use('/api/billing/*', teamMiddleware('Billing'));
app.use('/api/identity/*', teamMiddleware('Identity'));

// Routes mounted underneath these prefixes inherit the team automatically.
app.post('/api/billing/charge', chargeHandler);
app.get('/api/identity/me', meHandler);
```

This is the cleanest setup if your URL structure already mirrors team ownership.

## What the middleware actually does

```ts
(_c, next) => runWithOwner(team, () => next());
```

That's it. AsyncLocalStorage holds the team for the duration of `next()` and any async work it spawns. Anything downstream calling `currentOwner()` — handlers, span processors, Sentry event processors — gets the team back.

## Pairing with `hono/context-storage`

Hono ships its own AsyncLocalStorage helper (`contextStorage()` / `getContext()`) that exposes the request `Context` to code outside the handler call stack. The two work fine together — they use independent ALS instances. If you want both, register `contextStorage()` first:

```ts
import { contextStorage } from 'hono/context-storage';

app.use(contextStorage());
app.use(teamMiddleware('Billing'));
```

Order doesn't really matter for correctness, but registering `contextStorage()` first means it sees every request including ones that get short-circuited by team-tagged middleware (none of those exist by default, but it's the safer default).

## Pairing with `@strays/sentry` and `@strays/datadog`

Nothing extra to wire up. Once `installSentry` / `installDatadog` are running, every error and span emitted from a route picks up the team from the scope:

```
teamMiddleware('Billing')
    → runWithOwner('Billing', () => next())
        → handler runs
            → throws or starts a span
                → installSentry / installDatadog reads currentOwner()
                    → tag = 'Billing'
```

## Caveats

- The middleware doesn't write to `c.var`. If you want `c.var.team` available inside handlers, set it yourself: `(c, next) => { c.set('team', team); return runWithOwner(team, () => next()); }`. I left it out to avoid forcing a `Variables` shape on consumers.
- WebSocket and SSE handlers that push outside the request lifecycle aren't covered by the middleware's scope — wrap the push site too if you need tagging there.

## Testing without `hono`

The exported types (`HonoMiddleware`, `HonoNext`) are structural — `c` is typed as `unknown` because the middleware never reads it. Pass any object as `c` and an async function as `next`. The package's own tests do this. See `src/teamMiddleware.test.ts`.
