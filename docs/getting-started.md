# Getting started

This guide walks through the minimum Ownheim setup for a TypeScript monorepo.

## 1. Install packages

```bash
bun add @ownheim/core @ownheim/cli
```

Add framework or observability adapters only when you need them.

## 2. Define teams and ownership rules

Create `ownheim.config.ts` in your repository root:

```ts
import { defineOwnheim } from '@ownheim/core/defineOwnheim';

export default defineOwnheim({
  teams: {
    Accounts: {
      github: '@org/accounts',
      owns: ['packages/accounts/**'],
    },
    Billing: {
      github: '@org/billing',
      owns: ['packages/billing/**'],
    },
  },
});
```

Each team can own one or more globs. Ownheim uses these rules to generate `CODEOWNERS`, build the runtime ownership manifest, and report ownership coverage.

## 3. Generate artifacts

```bash
bunx ownheim generate
```

This writes:

- `.github/CODEOWNERS`
- `.ownheim/ownership.json`

Commit both files unless your repository has a different artifact policy.

## 4. Check ownership in CI

```bash
bunx ownheim check
bunx ownheim coverage
```

`check` fails when generated artifacts are out of date. `coverage` reports files without explicit non-fallback ownership.

## 5. Register the runtime manifest

At application startup:

```ts
import { registerOwnershipManifest } from '@ownheim/core/manifest/defaultRegistry';
import manifest from './.ownheim/ownership.json' with { type: 'json' };

registerOwnershipManifest(manifest);
```

Runtime adapters use this manifest to resolve code ownership from stack frames and attach ownership context to telemetry.

## 6. Mark entrypoints

Example with Express:

```ts
import { entrypointOwner } from '@ownheim/express';

app.use('/api/accounts', entrypointOwner('Accounts'));
```

Telemetry emitted during that request can include `ownheim.entrypoint_team=Accounts`.

## 7. Mark responders for cross-team failures

```ts
import { OwnedError } from '@ownheim/core/OwnedError';

throw new OwnedError('Ledger write failed', {
  responderTeam: 'Billing',
});
```

Use responder ownership when the team best positioned to remediate a failure differs from the entrypoint owner.
