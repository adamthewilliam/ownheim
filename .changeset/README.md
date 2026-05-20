# Changesets

This repo uses [Changesets](https://github.com/changesets/changesets) for versioning and publishing.

## Creating a changeset

```bash
bun run changeset
```

## Fixed versioning

All publishable `@ownheim/*` packages are in a single fixed version group (they always share the same version).

## Release flow (typical)

1. Create one or more changesets in PRs.
2. On the release PR/commit, run:

```bash
bun run release:version
```

3. After merging to `main`, publish:

```bash
bun run release:publish
```

`release:publish` runs `check:publish` first to ensure no `workspace:` dependency specs leak into packed tarballs.
