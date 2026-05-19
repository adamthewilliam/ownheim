# @strays/datadog

Tag Datadog spans with Strays' layered ownership model.

Strays emits separate tags for separate questions:

| Concept | Tag |
|---|---|
| Entrypoint owner | `strays.entrypoint_team` |
| Code owner | `strays.code_team` |
| Responder | `strays.responder_team` |

## Install

```bash
bun add @strays/datadog @strays/core
```

You also need `dd-trace`.

## Server

```ts
import tracer from 'dd-trace';
import { instrumentDatadog } from '@strays/datadog';

tracer.init({ service: 'api' });
instrumentDatadog(tracer);
```

## Entrypoint ownership

```ts
import { runWithEntrypointOwner } from '@strays/core/ownership';

app.post('/charge', (req, res) =>
  runWithEntrypointOwner('Billing', async () => {
    res.json(await chargeCustomer(req.body));
  }),
);
```

Spans started inside the operation include:

```txt
strays.entrypoint_team=Billing
```

## Code ownership

Register the generated manifest once at process startup:

```ts
import manifest from './.strays/ownership.json' with { type: 'json' };
import { registerOwnershipManifest } from '@strays/core';

registerOwnershipManifest(manifest);
```

Spans also include `strays.code_team` based on the file/package that started the span.

## Responder ownership

```ts
import { OwnedError } from '@strays/core';

throw new OwnedError('payment provider timed out', {
  responderTeam: 'Billing',
});
```

Telemetry for that failure can include:

```txt
strays.responder_team=Billing
```

## Options

```ts
instrumentDatadog(tracer, {
  fallbackCodeTeam: 'platform',
  tags: {
    entrypointTeam: 'strays.entrypoint_team',
    codeTeam: 'strays.code_team',
    responderTeam: 'strays.responder_team',
  },
});
```

## Browser RUM

```ts
import { datadogRum } from '@datadog/browser-rum';
import { installDatadogRum } from '@strays/datadog/rum';

datadogRum.init({ applicationId: '...', clientToken: '...', service: 'web' });
installDatadogRum(datadogRum, 'web-platform');
```
