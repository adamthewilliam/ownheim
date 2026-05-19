# @strays/express

Tag every Express route with the team that owns it.

This is an Express middleware factory. It wraps the rest of the request chain in a `runWithEntrypointOwner` scope so any span, log, or error emitted while the route handler runs is tagged automatically.

## Install

```bash
bun add @strays/express @strays/runtime @strays/core
```

You also need `express`. Strays doesn't pin a version. Anything with the standard `(req, res, next)` middleware shape works — including Express 4 and 5.

## Per-route

```ts
import express from 'express';
import { entrypointOwner } from '@strays/express/entrypointOwner';

const app = express();

app.post('/charge', entrypointOwner('Billing'), chargeHandler);
app.get('/users/:id', entrypointOwner('Identity'), getUserHandler);
app.delete('/admin/users/:id', entrypointOwner('Platform'), authMiddleware, deleteUser);
```

`entrypointOwner(team)` returns a middleware. Slot it into the chain wherever ownership starts. Anything *after* `entrypointOwner()` in the chain — including the final route handler — sees the team.

## Per-prefix

Express supports path mounting on `app.use`, so the same factory works for prefix-level tagging:

```ts
app.use('/api/billing', entrypointOwner('Billing'));
app.use('/api/identity', entrypointOwner('Identity'));

// Routes underneath these prefixes inherit the team:
app.post('/api/billing/charge', chargeHandler);
app.get('/api/identity/me', meHandler);
```

This is the cleanest shape if your URL structure already mirrors team ownership.

## Per-router

If you split your app into multiple `express.Router()` instances, mount `entrypointOwner()` once at the router level:

```ts
const billingRouter = express.Router();
billingRouter.use(entrypointOwner('Billing'));
billingRouter.post('/charge', chargeHandler);
billingRouter.get('/invoice/:id', getInvoiceHandler);

app.use('/api/billing', billingRouter);
```

## What the middleware actually does

```ts
(_req, _res, next) => { runWithEntrypointOwner(team, () => next()); };
```

That's it. AsyncLocalStorage holds the team for the duration of the synchronous `next()` call, and any async work spawned by downstream middleware or the route handler inherits the snapshot. Anything calling `currentEntrypointOwner()` downstream gets the team back.

## A note on Express 5 and async handlers

Express 5 supports promises returned from handlers. The team scope still applies because ALS propagation is automatic — `next()` is called synchronously inside `runWithEntrypointOwner`, and any promise the downstream chain returns inherits the snapshot from that call site.

Express 4 works too, but if your handlers return promises and you don't `.catch` them, errors won't be tagged correctly because they bypass the chain. Use [`express-async-errors`](https://www.npmjs.com/package/express-async-errors) or wrap manually.

## Pairing with `@strays/sentry` and `@strays/datadog`

Nothing extra to wire up. Once `installSentry` / `instrumentDatadog` are running, every error and span emitted from a route picks up the team from the scope:

```
entrypointOwner('Billing')
    → runWithEntrypointOwner('Billing', () => next())
        → handler runs
            → throws or starts a span
                → installSentry / instrumentDatadog reads currentEntrypointOwner()
                    → tag = 'Billing'
```

## Caveats

- The middleware doesn't write to `req`. If you want `req.team` available inside handlers, set it yourself: `(req, _res, next) => { (req as any).team = team; runWithEntrypointOwner(team, () => next()); }`. I left it out to avoid forcing a request-shape augmentation.
- Long-lived connections (SSE, WebSocket upgrades) that push data outside the request lifecycle aren't covered by the middleware's scope. Wrap the push site too if you need tagging there.

## Testing without `express`

`ExpressMiddleware` and `ExpressNext` are structural — `req` and `res` are typed as `unknown` because the middleware never reads them. Pass empty objects and a callback. The package's own tests do this. See `src/entrypointOwner.test.ts`.
