# @ownheim/sentry

Tag Sentry events with Ownheim ownership context.

This is an adapter — `@sentry/*` is your dependency, not ours. Ownheim only needs a client with `addEventProcessor`.

## Install

```bash
bun add @ownheim/sentry @ownheim/core
```

You'll also need whichever Sentry SDK you're using (`@sentry/node`, `@sentry/bun`, `@sentry/browser`, etc.).

## Tag events at runtime

```ts
import * as Sentry from '@sentry/node';
import { instrumentSentry } from '@ownheim/sentry/instrument';

Sentry.init({ dsn: process.env.SENTRY_DSN });
instrumentSentry(Sentry.getClient()!);
```

Every processed event is merged with Ownheim tags such as `ownheim.entrypoint_team`, `ownheim.code_team`, and `ownheim.responder_team`.

Ownership is resolved from three layers:

1. **Responder ownership** from an `OwnedError` or an error annotated with `withResponderTeam`.
2. **Entrypoint ownership** from `runWithEntrypointOwner` scope.
3. **Code ownership** from stack-frame manifest lookup, falling back to `unowned` by default.

```ts
import { OwnedError } from '@ownheim/core/OwnedError';
import { runWithEntrypointOwner } from '@ownheim/core/ownership';

app.get('/users/:id', (req, res) =>
  runWithEntrypointOwner('Identity', async () => {
    res.json(await getUser(req.params.id));
  }),
);

throw new OwnedError('user not found', {
  responderTeam: 'Identity',
});
```

## Options

```ts
instrumentSentry(client, {
  fallbackCodeTeam: 'platform',
  tags: {
    entrypointTeam: 'ownheim.entrypoint_team',
    codeTeam: 'ownheim.code_team',
    responderTeam: 'ownheim.responder_team',
  },
});
```

## Manifest lookup

Register the generated ownership manifest during application startup to let Sentry events resolve `ownheim.code_team` from stack frames:

```ts
import { registerOwnershipManifest } from '@ownheim/core/manifest/defaultRegistry';
import manifest from './dist/ownheim-manifest.json' with { type: 'json' };

registerOwnershipManifest(manifest);
```

Without a manifest, Sentry still gets responder and entrypoint ownership. Code ownership falls back to `fallbackCodeTeam` or `unowned`.

## Caveats

- `instrumentSentry` is idempotent for a client; calling it twice registers one processor.
- The processor mutates `event.tags` directly rather than returning a new event object. Sentry's processor contract allows this.
- Stack-frame lookup needs filenames Sentry can match against your manifest keys. If your build mangles paths, responder and entrypoint ownership still work.

## Testing without Sentry

`SentryClient` and `SentryEventProcessor` are structural types. You can build a mock client with a single `addEventProcessor` method, capture the registered processor, and call it directly with synthetic events. The package's tests do exactly this.
