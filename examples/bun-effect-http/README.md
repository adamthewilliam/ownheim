# Bun + Effect HTTP example

This example shows every feature exported by `@ownheim/effect`:

## `ownedBy`

`src/billing/charge.ts` and `src/auth/session.ts` define Effect `Schema.TaggedError` classes and tag them with responder ownership:

```ts
export class BillingError extends Schema.TaggedError<BillingError>()(...){ }
ownedBy(BillingError, 'Billing')
```

When these errors fail an Effect, Ownheim observability integrations can resolve `ownheim.responder_team`.

## `withOwnershipLogAnnotations`

`chargeInvoice`, `requireSession`, and `adminRefund` use Effect's native log annotations:

```ts
Effect.logInfo('charging invoice').pipe(
  withOwnershipLogAnnotations({ moduleOwner: 'Billing' })
)
```

This does not replace the user's Effect logger. `src/start.ts` installs a tiny example Effect logger that prints whatever annotations Effect provides.

## `withOwnershipSpan`

`chargeInvoice` and `adminRefund` wrap work in owned spans:

```ts
program.pipe(withOwnershipSpan('billing.chargeInvoice', { moduleOwner: 'Billing' }))
```

## `annotateOwnershipSpan`

`requireSession` demonstrates directly annotating the currently active span:

```ts
yield* annotateOwnershipSpan({ moduleOwner: 'Identity' })
```

## Entrypoint ownership

`src/start.ts` wraps each request in `runWithEntrypointOwner(owner, ...)`, so logs/spans/errors can also include request-entrypoint ownership.

## Config-defined ownership

`ownheim.config.ts` defines ownership rules. `ownheim generate` writes:

- `.github/CODEOWNERS`
- `dist/ownheim-manifest.json`

`src/start.ts` registers the generated manifest with `registerOwnershipManifest(...)`.
