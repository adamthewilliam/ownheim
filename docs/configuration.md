# Configuration guide

Ownheim configuration lives in `ownheim.config.ts` and should be the source of truth for team ownership.

## Basic configuration

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

## Teams

A team is a named owner. The team name is the value Ownheim uses in runtime ownership context and telemetry tags.

```ts
Accounts: {
  github: '@org/accounts',
  owns: ['packages/accounts/**'],
}
```

- `github` is used when generating `.github/CODEOWNERS`.
- `owns` defines file globs owned by the team.

## Ownership rules

Ownership globs should be specific enough to route code review and incidents to the right team.

```ts
Billing: {
  github: '@org/billing',
  owns: [
    'packages/billing/**',
    'apps/api/src/billing/**',
  ],
}
```

Prefer package, app, route, or domain boundaries over broad catch-all rules.

## Shared ownership

Use `shared` when more than one team owns the same path:

```ts
export default defineOwnheim({
  teams: {
    Accounts: { github: '@org/accounts', owns: ['packages/accounts/**'] },
    Billing: { github: '@org/billing', owns: ['packages/billing/**'] },
  },
  shared: [
    {
      glob: 'packages/account-billing-contracts/**',
      owners: ['Accounts', 'Billing'],
    },
  ],
});
```

## Fallback ownership

Use `fallback` for legacy code while migrating toward explicit ownership:

```ts
export default defineOwnheim({
  teams: {
    Platform: { github: '@org/platform', owns: ['packages/platform/**'] },
  },
  fallback: 'Platform',
});
```

Fallback-owned files are not counted as explicitly owned in coverage reports.

## Generated artifacts

Run:

```bash
bunx ownheim generate
```

Ownheim generates:

| Artifact | Purpose |
|---|---|
| `.github/CODEOWNERS` | GitHub review ownership derived from config |
| `.ownheim/ownership.json` | Runtime manifest for resolving code ownership |

## Useful CLI commands

```bash
bunx ownheim generate      # regenerate CODEOWNERS + runtime manifest
bunx ownheim check         # fail if generated ownership artifacts drift
bunx ownheim coverage      # report explicit ownership coverage
```

## Recommended CI policy

At minimum, run:

```bash
bunx ownheim check
bunx ownheim coverage
```

