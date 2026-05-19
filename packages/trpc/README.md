# @strays/trpc

Tag every tRPC procedure with the team that owns it, in a way TypeScript can verify.

This is a tRPC middleware. It wraps the procedure's handler in a `runWithEntrypointOwner` scope so that every span, log, and error emitted while the procedure runs is automatically tagged with the right entrypoint team — by `@strays/datadog`, `@strays/sentry`, `@strays/otel`, or anything else that reads `currentEntrypointOwner()`.

## Install

```bash
bun add @strays/trpc @strays/runtime @strays/core
```

You also need `@trpc/server`. Strays doesn't pin a version. Anything with the standard `.use(middleware)` builder API (v10, v11) works.

## Two ways to use it

### As a procedure builder helper

`entrypointProcedure(builder, owner)` returns the builder with the owner middleware already chained on:

```ts
import { initTRPC } from '@trpc/server';
import { entrypointProcedure } from '@strays/trpc/entrypointProcedure';

const t = initTRPC.create();

const billingProcedure = entrypointProcedure(t.procedure, 'Billing');
const identityProcedure = entrypointProcedure(t.procedure, 'Identity');

export const appRouter = t.router({
  charge: billingProcedure.input(chargeSchema).mutation(chargeHandler),
  getUser: identityProcedure.input(z.string()).query(getUserHandler),
});
```

You can also chain it onto an existing builder (for example, `protectedProcedure`):

```ts
const billingAuthed = entrypointProcedure(protectedProcedure, 'Billing');
```

### As a raw middleware

If you'd rather use `.use()` yourself, `entrypointOwner(owner)` returns the bare middleware function:

```ts
import { entrypointOwner } from '@strays/trpc/entrypointOwner';

const billingProcedure = t.procedure
  .use(authMiddleware)
  .use(entrypointOwner('Billing'))
  .use(loggingMiddleware);
```

Order matters here only if other middlewares read `currentEntrypointOwner()`. Anything *after* `entrypointOwner` in the chain sees the owner; anything before doesn't.

## What the middleware actually does

```ts
({ next }) => runWithEntrypointOwner(owner, () => next());
```

That's the whole thing. AsyncLocalStorage holds the owner for the duration of `next()` and any async work it spawns. The next time something downstream calls `currentEntrypointOwner()` — inside a handler, inside a span processor, inside an event processor — it gets the owner back. On the wire (logs, spans, Sentry tags) it's emitted as `strays.entrypoint_team`.

## Pairing it with the lint rule

The real win is at the type level. If every procedure in your router is built from an owner-tagged builder, you can add an `@strays/oxlint` rule that flags any router member built from the bare `t.procedure`. That gives you compile-time owner coverage for your entire API surface without runtime checks.

In practice this means: do a one-time audit, replace every `t.procedure` with an owner-tagged variant, and turn the lint rule on. New procedures can't be added without picking an owner.

## Pairing it with `@strays/sentry` and `@strays/datadog`

Nothing extra to do. Once `installSentry` / `instrumentDatadog` are running, every error and span emitted from inside a procedure picks up the owner from the scope. The owner flows through:

```
entrypointProcedure(builder, 'Billing')
    → runWithEntrypointOwner('Billing', () => handler())
        → handler does work
            → throws or starts a span
                → installSentry / instrumentDatadog reads currentEntrypointOwner()
                    → tag = 'Billing'
```

If the handler throws an `OwnedError` with a *different* owner, that wins (errors carry their own ownership). The procedure's owner is the default; explicit `OwnedError`s are the override.

## Caveats

- The middleware doesn't extend the tRPC context. If you want `ctx.team` available inside handlers, do it explicitly: `({ ctx, next }) => runWithEntrypointOwner(owner, () => next({ ctx: { ...ctx, team: owner } }))`. I left this out of the default to avoid forcing a context shape on consumers.
- Subscriptions work the same way for the initial call, but be careful with long-running streams — the scope covers the subscription handler, not necessarily every emit if you've broken out of the async chain. If you push from outside the scope, wrap the push site too.
- `entrypointProcedure(t.procedure, 'X')` mutates the builder it's given (because `.use()` returns the same instance in tRPC). If you want a fresh copy, call `t.procedure` again rather than reusing a variable.

## Testing without `@trpc/server`

The exported types (`TrpcMiddleware`, `TrpcMiddlewareOpts`, `TrpcProcedureBuilder`) are structural. You can hand-roll a mock builder with a `.use()` method and test owner tagging without pulling in tRPC. The package's own tests do this. See `src/entrypointProcedure.test.ts` for a working example of a mock that runs a middleware chain.
