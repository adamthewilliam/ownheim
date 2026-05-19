# @ownheim/orpc

Tag every oRPC procedure with the team that owns it.

This is an oRPC middleware. It wraps the procedure's handler in a `runWithEntrypointOwner` scope so every span, log, and error emitted while it runs is tagged with the right entrypoint team automatically.

## Install

```bash
bun add @ownheim/orpc @ownheim/runtime @ownheim/core
```

You also need `@orpc/server`. Ownheim doesn't pin a version. Anything with the standard `.use(middleware)` builder API works.

## Two ways to use it

### As a procedure builder helper

`entrypointProcedure(builder, owner)` returns the builder with the owner middleware already chained on:

```ts
import { os } from '@orpc/server';
import { entrypointProcedure } from '@ownheim/orpc/entrypointProcedure';

const billing = entrypointProcedure(os, 'Billing');
const identity = entrypointProcedure(os, 'Identity');

export const router = {
  charge: billing.input(chargeSchema).handler(chargeHandler),
  getUser: identity.input(z.string()).handler(getUserHandler),
};
```

You can also chain it onto an existing builder (for example, a `protectedProcedure` that already has auth middleware):

```ts
const billingAuthed = entrypointProcedure(protectedProcedure, 'Billing');
```

### As a raw middleware

If you'd rather use `.use()` yourself, `entrypointOwner(owner)` returns the bare middleware function:

```ts
import { entrypointOwner } from '@ownheim/orpc/entrypointOwner';

const billing = os
  .use(authMiddleware)
  .use(entrypointOwner('Billing'))
  .use(loggingMiddleware);
```

Order matters here only if other middlewares read `currentEntrypointOwner()`. Anything *after* `entrypointOwner` in the chain sees the owner; anything before doesn't.

## What the middleware actually does

```ts
({ next }) => runWithEntrypointOwner(owner, () => next());
```

That's the whole thing. AsyncLocalStorage holds the owner for the duration of `next()` and any async work the handler spawns. The next time something downstream calls `currentEntrypointOwner()` — inside the handler, inside a span processor, inside an event processor — it gets the owner back. On the wire (logs, spans, Sentry tags) it's emitted as `ownheim.entrypoint_team`.

## Why a builder helper *and* a middleware?

oRPC supports both shapes natively. `os.use(...)` is the single-line case; defining `publicProcedure = os.use(...)` once and reusing it is the [recommended pattern](https://orpc.unnoq.com) for things like auth. The builder helper just makes it ergonomic to derive an owner-tagged variant from any existing builder.

## Pairing it with `@ownheim/sentry` and `@ownheim/datadog`

Nothing extra to do. Once `installSentry` / `instrumentDatadog` are running, every error and span emitted from inside a procedure picks up the owner from the scope:

```
entrypointProcedure(os, 'Billing')
    → runWithEntrypointOwner('Billing', () => next())
        → handler does work
            → throws or starts a span
                → installSentry / instrumentDatadog reads currentEntrypointOwner()
                    → tag = 'Billing'
```

If the handler throws an `OwnedError` with a *different* owner, that wins (errors carry their own ownership). The procedure's owner is the default; explicit `OwnedError`s are the override.

## Caveats

- The middleware doesn't extend the oRPC context. If you want `context.team` available inside handlers, do it explicitly: `({ context, next }) => runWithEntrypointOwner(owner, () => next({ context: { ...context, team: owner } }))`. I left it out to avoid forcing a context shape.
- For the constructed-middleware idiom (`os.middleware(...)`), wrap the bare function: `const billingMw = os.middleware(entrypointOwner('Billing'))`. Then `.use(billingMw)`. Both forms work.
- `entrypointProcedure(os, 'X')` chains `.use()`, which in oRPC returns the same builder reference. If you want a fresh copy for branching, derive from `os` directly each time.

## Testing without `@orpc/server`

The exported types (`OrpcMiddleware`, `OrpcMiddlewareOpts`, `OrpcProcedureBuilder`) are structural. You can hand-roll a mock builder with a `.use()` method and test owner tagging without pulling oRPC in. The package's own tests do this. See `src/entrypointProcedure.test.ts` for a working example of a mock that runs a middleware chain.
