# @strays/sentry

Tag every Sentry event with the team that owns the code, and push your `CODEOWNERS` file to Sentry so issues route to the right GitHub team automatically.

This is an adapter — `@sentry/*` is your dependency, not ours. The runtime piece registers an event processor on the Sentry client you already have. The build-time piece is a one-shot helper for your release pipeline.

## Install

```bash
bun add @strays/sentry @strays/runtime @strays/core
```

You'll also need whichever Sentry SDK you're using (`@sentry/node`, `@sentry/bun`, `@sentry/browser`, etc.). Strays doesn't pin a version. The adapter only needs `client.addEventProcessor`, which has been stable for a long time.

## Tag events at runtime

```ts
import * as Sentry from '@sentry/node';
import { installSentry } from '@strays/sentry/install';

Sentry.init({ dsn: process.env.SENTRY_DSN });
installSentry(Sentry.getClient()!);
```

That's it. Every event Sentry sends (exceptions, messages, transactions) now carries a `team` tag. You can filter, alert, and route on it from the Sentry UI.

There are three ways the team gets resolved, in order:

1. **`OwnedError`** on the captured exception. Throw `new OwnedError('msg', 'Billing')` and the team rides with the error wherever it goes.
2. **`runWithEntrypointOwner` scope.** Wrap a request handler and any error captured inside picks up the scope's owner.
3. **Stack-frame manifest lookup.** If you've loaded a manifest (built from `strays.config.ts`), the processor walks the event's stack frames bottom-up, skips `node_modules` / `node:` internals / `in_app: false` frames, and asks the manifest who owns the first file that matches.

If none of those resolve, you get the fallback (`'unowned'` by default).

```ts
// scope-based
import { runWithEntrypointOwner } from '@strays/runtime/runWithEntrypointOwner';

app.get('/users/:id', (req, res) =>
  runWithEntrypointOwner('Identity', async () => {
    res.json(await getUser(req.params.id));
  }),
);

// error-based
import { OwnedError } from '@strays/core/OwnedError';
throw new OwnedError('user not found', 'Identity');
```

### Options

```ts
installSentry(client, {
  fallback: 'platform',     // default tag value when nothing resolves
  tagKey: 'sentry.team',    // override the tag key (default: 'team')
});
```

I'd leave `tagKey` alone unless `team` is already meaningful in your Sentry org. Sentry's built-in alert routing and search work with any tag, but other tools assume the conventional name.

### Why the manifest lookup matters

The `OwnedError` and `runWithEntrypointOwner` paths cover the cases you instrument explicitly. The stack-frame fallback covers everything else — uncaught errors from cron jobs, third-party callbacks, anywhere you forgot to wrap. If you've generated an ownership manifest from `strays.config.ts`, you get sensible team tagging on errors you didn't even know existed. That's most of the value of this package.

Without a manifest loaded, the third step is a no-op and you fall through to the fallback. That's fine for getting started. Add the manifest later.

## Sync CODEOWNERS to Sentry

Sentry has its own ownership system. If you point it at your `CODEOWNERS` file, it'll auto-assign issues to the matching GitHub team. The `syncCodeowners` helper pushes the file to Sentry's API so you don't have to paste it into the UI every time it changes.

This is a build-time / CI utility, not something you call from your app:

```ts
// scripts/sync-sentry-codeowners.ts
import { readFile } from 'node:fs/promises';
import { syncCodeowners } from '@strays/sentry/syncCodeowners';

const result = await syncCodeowners({
  authToken: process.env.SENTRY_AUTH_TOKEN!,
  organization: 'acme',
  project: 'api',
  codeowners: await readFile('.github/CODEOWNERS', 'utf8'),
});

if (!result.ok) {
  console.error(`Sentry rejected the codeowners file: ${result.status}`);
  process.exit(1);
}
```

Run it from a GitHub Action after `strays generate` regenerates `.github/CODEOWNERS`. The token needs `project:write` scope.

The function takes an optional `endpoint` (defaults to `https://sentry.io/api/0`) for self-hosted Sentry, and an optional `fetchImpl` mostly for testing.

## Caveats

- Calling `installSentry` twice registers two processors and you'll merge `team` twice. Idempotent it isn't. Call it once at boot.
- The processor mutates `event.tags` directly rather than returning a new event. Sentry's contract allows this; just be aware if you're chaining processors.
- Stack-frame lookup needs filenames Sentry can match against your manifest keys. If your build mangles paths (bundling, sourcemap stripping), the manifest fallback will miss. The `OwnedError` and scope paths still work.
- `syncCodeowners` overwrites the project's codeowners config. There's no diff. If someone edited it in the Sentry UI, that edit goes away on the next sync. This is the point. `strays.config.ts` is the source of truth.

## Testing without Sentry

`SentryClient` and `SentryEventProcessor` are structural types. You can build a mock client with a single `addEventProcessor` method, capture the registered processor, and call it directly with synthetic events. The package's tests do exactly this. See `src/install.test.ts`.
