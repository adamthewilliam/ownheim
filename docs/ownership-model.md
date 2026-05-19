# Ownership model

Strays tracks ownership at three different layers because large TypeScript monorepos often need to answer three different operational questions.

| Concept | Question it answers | Set by | Telemetry tag |
|---|---|---|---|
| Entrypoint owner | Who owns the operation that started this work? | HTTP/RPC/job/event entrypoint wrappers | `strays.entrypoint_team` |
| Code owner | Who owns the source file or package emitting telemetry? | `strays.config.ts` + generated ownership manifest | `strays.code_team` |
| Responder | Who should investigate, mitigate, or remediate this failure? | Explicit error annotation | `strays.responder_team` |

## Entrypoint owner

The entrypoint owner is the team accountable for the request, job, procedure, event, command, or workflow that started the work.

Entrypoints include:

- HTTP routes
- tRPC / oRPC procedures
- queue consumers
- cron jobs
- workflow starts
- event handlers
- CLI commands
- service startup tasks

Example:

```ts
app.use('/api/accounts', entrypointOwner('Accounts'));
```

Telemetry emitted during that request includes:

```txt
strays.entrypoint_team=Accounts
```

## Code owner

The code owner is the team accountable for the source file or package emitting telemetry. Code ownership comes from `strays.config.ts` and the generated ownership manifest. It is also used to generate `.github/CODEOWNERS`.

Example:

```ts
export default defineStrays({
  teams: {
    Billing: {
      github: '@acme/billing',
      owns: ['packages/billing/**'],
    },
  },
});
```

Telemetry emitted from `packages/billing/**` includes:

```txt
strays.code_team=Billing
```

## Responder

The responder is the team best positioned to investigate, mitigate, or remediate a failure.

Responder ownership is explicit because failures often cross team boundaries. It is not a blame signal; it is an operational routing signal.

Example:

```ts
throw new OwnedError('Ledger write failed', {
  responderTeam: 'Billing',
});
```

Telemetry for that error includes:

```txt
strays.responder_team=Billing
```

## Cross-team example

An Accounts-owned endpoint calls Billing-owned ledger code, and the ledger fails:

```txt
POST /api/accounts/update
  -> packages/billing/src/ledger.ts
  -> ledger write fails
```

Strays emits:

```json
{
  "strays.entrypoint_team": "Accounts",
  "strays.code_team": "Billing",
  "strays.responder_team": "Billing"
}
```

This tells engineers: an Accounts-owned operation reached Billing-owned code, and Billing is the right team to respond.
