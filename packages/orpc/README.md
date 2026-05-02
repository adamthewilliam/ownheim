# @strays/orpc

Tag every oRPC procedure with the team that owns it.

This is an oRPC middleware. It wraps the procedure's handler in a `runWithOwner` scope so every span, log, and error emitted while it runs is tagged with the right team automatically.

## Install

```bash
bun add @strays/orpc @strays/runtime @strays/core
```

You also need `@orpc/server`. Strays doesn't pin a version. Anything with the standard `.use(middleware)` builder API works.

## Two ways to use it

### As a procedure builder helper

`teamProcedure(builder, team)` returns the builder with the team middleware already chained on:

```ts
import { os } from '@orpc/server';
import { teamProcedure } from '@strays/orpc/teamProcedure';

const billing = teamProcedure(os, 'Billing');
const identity = teamProcedure(os, 'Identity');

export const router = {
  charge: billing.input(chargeSchema).handler(chargeHandler),
  getUser: identity.input(z.string()).handler(getUserHandler),
};
```

You can also chain it onto an existing builder (for example, a `protectedProcedure` that already has auth middleware):

```ts
const billingAuthed = teamProcedure(protectedProcedure, 'Billing');
```

### As a raw middleware

If you'd rather use `.use()` yourself, `teamMiddleware(team)` returns the bare middleware function:

```ts
import { teamMiddleware } from '@strays/orpc/teamMiddleware';

const billing = os
  .use(authMiddleware)
  .use(teamMiddleware('Billing'))
  .use(loggingMiddleware);
```

Order matters here only if other middlewares read `currentOwner()`. Anything *after* `teamMiddleware` in the chain sees the team; anything before doesn't.

## What the middleware actually does

```ts
({ next }) => runWithOwner(team, () => next());
```

That's the whole thing. AsyncLocalStorage holds the team for the duration of `next()` and any async work the handler spawns. The next time something downstream calls `currentOwner()` — inside the handler, inside a span processor, inside an event processor — it gets the team back.

## Why a builder helper *and* a middleware?

oRPC supports both shapes natively. `os.use(...)` is the single-line case; defining `publicProcedure = os.use(...)` once and reusing it is the [recommended pattern](https://orpc.unnoq.com) for things like auth. The builder helper just makes it ergonomic to derive a team-tagged variant from any existing builder.

## Pairing it with `@strays/sentry` and `@strays/datadog`

Nothing extra to do. Once `installSentry` / `installDatadog` are running, every error and span emitted from inside a procedure picks up the team from the scope:

```
teamProcedure(os, 'Billing')
    → runWithOwner('Billing', () => next())
        → handler does work
            → throws or starts a span
                → installSentry / installDatadog reads currentOwner()
                    → tag = 'Billing'
```

If the handler throws an `OwnedError` with a *different* team, that wins (errors carry their own ownership). The procedure's team is the default; explicit `OwnedError`s are the override.

## Caveats

- The middleware doesn't extend the oRPC context. If you want `context.team` available inside handlers, do it explicitly: `({ context, next }) => runWithOwner(team, () => next({ context: { ...context, team } }))`. I left it out to avoid forcing a context shape.
- For the constructed-middleware idiom (`os.middleware(...)`), wrap the bare function: `const billingMw = os.middleware(teamMiddleware('Billing'))`. Then `.use(billingMw)`. Both forms work.
- `teamProcedure(os, 'X')` chains `.use()`, which in oRPC returns the same builder reference. If you want a fresh copy for branching, derive from `os` directly each time.

## Testing without `@orpc/server`

The exported types (`OrpcMiddleware`, `OrpcMiddlewareOpts`, `OrpcProcedureBuilder`) are structural. You can hand-roll a mock builder with a `.use()` method and test team tagging without pulling oRPC in. The package's own tests do this. See `src/teamProcedure.test.ts` for a working example of a mock that runs a middleware chain.
