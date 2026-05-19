# Turborepo monorepo example

A realistic Ownheim example for a Turborepo workspace with one app and three packages:

- `apps/storefront` — the customer-facing app
- `packages/core` — shared platform primitives owned by Platform
- `packages/checkout` — checkout domain code owned by Checkout
- `packages/catalog` — catalog domain code owned by Catalog

The `ownheim.config.ts` file demonstrates package ownership, app route ownership, a Platform fallback owner, and a shared route owned by both Catalog and Checkout.

```bash
bun install
bun run build
bun run test
bunx ownheim generate --config ownheim.config.ts
```
