# Architecture RFCs

Module-deepening proposals for the strays monorepo. Each RFC identifies a shallow-module cluster, sketches alternative interfaces, and recommends one — per Ousterhout's *A Philosophy of Software Design* (deep modules: small interface, large hidden implementation).

| # | RFC | Cluster | New module |
|---|---|---|---|
| 0001 | [resolve-owner](./0001-resolve-owner.md) | 5 duplicates of the team-resolution chain across runtime + datadog/sentry/otel | `@strays/runtime/resolveOwner` + `FrameSource` port |
| 0002 | [team-middleware](./0002-team-middleware.md) | 4 framework adapters re-implementing `runWithOwner`-wrapping middleware | `@strays/runtime/withTeamScope` |
| 0003 | [glob-matcher](./0003-glob-matcher.md) | Duplicate glob specificity + implicit picomatch config | `@strays/build/globMatcher` |
| 0004 | [manifest-registry](./0004-manifest-registry.md) | Mutable module-globals in `manifest.ts` causing test-isolation bugs | `ManifestRegistry` value + `getDefaultRegistry()` |
| 0005 | [lint-rule-registry](./0005-lint-rule-registry.md) | Mirror rule files in `oxlint/` and `eslint/` | Auto-registration via `lint-core/rules/registry` + adapter projector |
| 0006 | [analyze-source-file](./0006-analyze-source-file.md) | Regex `transformLoggerImports` next to AST `extract` — two machineries on the same files | Unified `analyzeSourceFile` AST pass |
| 0007 | [format-owned-log-entry](./0007-format-owned-log-entry.md) | Two logger implementations duplicating JSON + error-chain logic | Pure `formatOwnedLogEntry` + `LogSink` port |

Each RFC includes problem statement, candidate interfaces, recommended design, test strategy, and trade-offs. Status: proposed; none implemented.
