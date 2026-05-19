# Context

Ownheim is a code-first team ownership toolkit for TypeScript monorepos. Its purpose is to help teams find a home for every line of code and route operational signals to the right humans.

For full ownership terminology, see [`docs/ownership-model.md`](./docs/ownership-model.md).

## Domain concepts

### Ownheim configuration

The project-level source of truth, usually `ownheim.config.ts`. It declares teams, ownership rules, shared ownership, and fallback ownership.

### Team

A named owner in the Ownheim configuration. Teams may map to GitHub CODEOWNERS handles and own file globs.

### Ownership rule

A mapping from file path patterns to one or more teams. Ownership rules are used to resolve code ownership, generate CODEOWNERS, and compute ownership coverage.

### Entrypoint owner

The team accountable for the operation that started work: HTTP route, RPC procedure, queue consumer, cron job, workflow, event handler, CLI command, or startup task.

Telemetry tag: `ownheim.entrypoint_team`.

### Code owner

The team accountable for the source file or package emitting telemetry. Code ownership is resolved from the Ownheim configuration and the generated ownership manifest.

Telemetry tag: `ownheim.code_team`.

### Responder

The team best positioned to investigate, mitigate, or remediate a failure. Responder ownership is explicit because failures often cross team lines.

Telemetry tag: `ownheim.responder_team`.

### Ownership manifest

The generated runtime artifact that maps source files or modules to code owners. Runtime integrations use it to resolve code owner context from stack frames.

### CODEOWNERS output

The generated `.github/CODEOWNERS` file derived from the Ownheim configuration and explicit per-file ownership metadata.

### Ownership audit

The process of analyzing source files, extracting explicit ownership metadata, resolving ownership rules, and classifying files as explicitly owned, fallback-owned, unowned, or invalid.

### Ownership coverage

A report of how much of the codebase has explicit non-fallback ownership. Coverage helps identify files that need clearer ownership.

### Ownership trace

An explanation of why a file resolved to a given owner: explicit JSDoc owner, matching rule, fallback owner, invalid owner, or no owner.

### Runtime ownership context

The ownership context attached to telemetry at runtime. It may include entrypoint owner, code owner, and responder.

### Telemetry ownership projection

The mapping from runtime ownership context into observability-specific tags, attributes, fields, or log entries.

### Entrypoint owner scope

The async execution scope that carries the current entrypoint owner through application code and telemetry instrumentation.

### Framework adapter

A package-specific adapter that applies Ownheim concepts to a framework or tool, such as Express, Hono, tRPC, oRPC, Datadog, OpenTelemetry, Pino, Sentry, ESLint, or Oxlint.

### Source analysis

The build-time parsing of TypeScript source files to extract ownership metadata and transform Ownheim runtime imports.

### Owned error

An error annotated with responder ownership so telemetry can route failures to the team best positioned to respond.
