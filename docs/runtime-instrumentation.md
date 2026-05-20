# Runtime instrumentation

Ownheim projects three ownership layers into telemetry:

- `ownheim.entrypoint_team`
- `ownheim.code_team`
- `ownheim.responder_team`

See [ownership model](./ownership-model.md) for terminology.

## Register the ownership manifest

Load the generated manifest once during process startup:

```ts
import { registerOwnershipManifest } from '@ownheim/core/manifest/defaultRegistry';
import manifest from './.ownheim/ownership.json' with { type: 'json' };

registerOwnershipManifest(manifest);
```

This enables runtime integrations to resolve code owners from stack frames.

## Entrypoint owners

Use framework adapters to mark the team accountable for the operation that started work.

### Express

```ts
import { entrypointOwner } from '@ownheim/express';

app.use('/api/accounts', entrypointOwner('Accounts'));
```

### Hono

```ts
import { entrypointOwner } from '@ownheim/hono';

app.use('/api/accounts/*', entrypointOwner('Accounts'));
```

### tRPC

```ts
import { entrypointProcedure } from '@ownheim/trpc';

const accountsProcedure = entrypointProcedure(publicProcedure, 'Accounts');
```

### oRPC

```ts
import { entrypointProcedure } from '@ownheim/orpc';

const accountsProcedure = entrypointProcedure(publicProcedure, 'Accounts');
```

## Responder ownership

Use `OwnedError` when a failure should route to a specific responder team:

```ts
import { OwnedError } from '@ownheim/core/OwnedError';

throw new OwnedError('Ledger write failed', {
  responderTeam: 'Billing',
});
```

Responder ownership is operational routing, not blame. It is useful when an Accounts-owned request fails in Billing-owned code.

## Observability adapters

### Datadog

```ts
import tracer from 'dd-trace';
import { instrumentDatadog } from '@ownheim/datadog';

tracer.init({ service: 'api' });
instrumentDatadog(tracer);
```

### Pino

```ts
import pino from 'pino';
import { ownershipMixin } from '@ownheim/pino';

const logger = pino({ mixin: ownershipMixin() });
```

### Sentry

```ts
import * as Sentry from '@sentry/node';
import { installSentry } from '@ownheim/sentry';

Sentry.init({ dsn: process.env.SENTRY_DSN });
installSentry(Sentry);
```

### OpenTelemetry

```ts
import { OwnershipSpanProcessor } from '@ownheim/otel';

provider.addSpanProcessor(new OwnershipSpanProcessor());
```

Check adapter package exports for exact signatures when upgrading between versions.
