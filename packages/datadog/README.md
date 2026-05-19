# @ownheim/datadog

Tag Datadog spans with Ownheim' layered ownership model.

Ownheim emits separate tags for separate questions:

| Concept | Tag |
|---|---|
| Entrypoint owner | `ownheim.entrypoint_team` |
| Code owner | `ownheim.code_team` |
| Responder | `ownheim.responder_team` |

## Install

```bash
bun add @ownheim/datadog @ownheim/core
```

You also need `dd-trace`.

## Server

```ts
import tracer from 'dd-trace';
import { instrumentDatadog } from '@ownheim/datadog';

tracer.init({ service: 'api' });
instrumentDatadog(tracer);
```

## Entrypoint ownership

```ts
import { runWithEntrypointOwner } from '@ownheim/core/ownership';

app.post('/charge', (req, res) =>
  runWithEntrypointOwner('Billing', async () => {
    res.json(await chargeCustomer(req.body));
  }),
);
```

Spans started inside the operation include:

```txt
ownheim.entrypoint_team=Billing
```

## Code ownership

Register the generated manifest once at process startup:

```ts
import manifest from './.ownheim/ownership.json' with { type: 'json' };
import { registerOwnershipManifest } from '@ownheim/core';

registerOwnershipManifest(manifest);
```

Spans also include `ownheim.code_team` based on the file/package that started the span.

## Responder ownership

```ts
import { OwnedError } from '@ownheim/core';

throw new OwnedError('payment provider timed out', {
  responderTeam: 'Billing',
});
```

Telemetry for that failure can include:

```txt
ownheim.responder_team=Billing
```

## Options

```ts
instrumentDatadog(tracer, {
  fallbackCodeTeam: 'platform',
  tags: {
    entrypointTeam: 'ownheim.entrypoint_team',
    codeTeam: 'ownheim.code_team',
    responderTeam: 'ownheim.responder_team',
  },
});
```

## Browser RUM

```ts
import { datadogRum } from '@datadog/browser-rum';
import { instrumentDatadogRum } from '@ownheim/datadog/rum';

datadogRum.init({ applicationId: '...', clientToken: '...', service: 'web' });
instrumentDatadogRum(datadogRum, { fallbackCodeTeam: 'web-platform' });
```
