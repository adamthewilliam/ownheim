# @strays/datadog

Tag every Datadog span and RUM error with the team that owns the code.

This is a thin adapter. It doesn't ship dd-trace or @datadog/browser-rum — you bring your own. It wraps the instances you already have so a `team` tag rides along on everything they emit.

## Install

```bash
bun add @strays/datadog @strays/runtime @strays/core
```

You also need `dd-trace` (server) or `@datadog/browser-rum` (browser). Strays doesn't pin either one. Any version that exposes `startSpan` / `addError` works.

## Server (dd-trace)

```ts
import tracer from 'dd-trace';
import { instrumentDatadog } from '@strays/datadog/install';

tracer.init({ service: 'api' });
instrumentDatadog(tracer);
```

That one call patches `tracer.startSpan` so every span gets a `team` tag added after it's created. You don't have to touch any of your existing instrumentation.

Now mark which code belongs to which team. Two options:

**Scope a request.** Wrap your handler (or a middleware) in `runWithOwner` and every span underneath gets the tag:

```ts
import { runWithOwner } from '@strays/runtime/runWithOwner';

app.post('/charge', (req, res) =>
  runWithOwner('Billing', async () => {
    const result = await chargeCustomer(req.body);
    res.json(result);
  }),
);
```

**Tag the error.** If a specific error path crosses team boundaries, throw an `OwnedError`:

```ts
import { OwnedError } from '@strays/core/OwnedError';

throw new OwnedError('payment provider timed out', 'Billing');
```

Resolution order is: `OwnedError` on the in-flight error → `runWithOwner` scope → the configured fallback. The fallback defaults to `'unowned'`, which is what you want. It makes orphan spans easy to find in Datadog.

### Options

```ts
instrumentDatadog(tracer, {
  fallback: 'platform',  // tag value when nothing resolves
  tagKey: 'dd.team',     // change the tag key (default: 'team')
});
```

Use a custom `tagKey` if `team` is already taken by something else in your Datadog setup.

## Browser (RUM)

Same idea, different hook. RUM has errors and global context instead of spans, so this one wraps `addError`:

```ts
import { datadogRum } from '@datadog/browser-rum';
import { installDatadogRum } from '@strays/datadog/rum';

datadogRum.init({ applicationId: '...', clientToken: '...', service: 'web' });
installDatadogRum(datadogRum, 'web-platform');
```

Every error reported through `datadogRum.addError(err)` now gets `team` attached to its context. Throw an `OwnedError` from your component code and the right team gets paged.

## How resolution actually works

When a span starts, `instrumentDatadog` calls `resolveOwner()`, which checks in order:

1. The error chain for an `OwnedError` (only useful in error-spans, mostly relevant for RUM)
2. `currentOwner()` — the value set by the active `runWithOwner` scope, via AsyncLocalStorage
3. `lookupCallerOwner(2)` — walks up the stack two frames and asks the manifest who owns that file
4. The fallback string

Step 3 is the quiet workhorse. If you've loaded an ownership manifest (built from your `strays.config.ts`), spans started outside any scope still get tagged based on which file called `startSpan`. That covers things like background jobs and cron handlers where wrapping every entry point in `runWithOwner` is annoying.

## Caveats

- `instrumentDatadog` mutates the tracer. Calling it twice will double-tag every span. Call it once at startup.
- The wrapper runs `setTag` after `startSpan` returns. If something else is reading the span synchronously between `startSpan` and the next tick, the tag won't be there yet. In practice this hasn't bitten anyone.
- RUM's `addError` is patched the same way. Calling `installDatadogRum` twice shows the team field twice in the context. Don't.

## Testing without dd-trace

The exported types (`DatadogTracer`, `DatadogSpan`, `DatadogRumLike`) are structural. You can hand-roll a mock with a `startSpan` method and pass it in. That's how the package's own tests work. See `src/install.test.ts` if you want a copy-paste starting point.
