import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { trace } from '@opentelemetry/api';
import { BasicTracerProvider, ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { registerOwnershipManifest } from '@ownheim/core/manifest/defaultRegistry';
import { entrypointOwner } from '@ownheim/hono';
import { OwnershipSpanProcessor } from '@ownheim/otel';
import { checkout } from './billing/checkout.ts';
import { profile } from './identity/profile.ts';

// Generate this with: bun run generate
const manifestPath = new URL('../dist/ownheim-manifest.json', import.meta.url);
try {
  const manifest = await import(manifestPath.href, { with: { type: 'json' } });
  registerOwnershipManifest(manifest.default);
} catch {
  // Entrypoint ownership still works before manifest generation.
}

const provider = new BasicTracerProvider({
  spanProcessors: [
    new OwnershipSpanProcessor({ fallbackCodeTeam: 'Platform' }),
    new SimpleSpanProcessor(new ConsoleSpanExporter()),
  ],
});
trace.setGlobalTracerProvider(provider);

const app = new Hono();

app.use('/api/billing/*', entrypointOwner('Billing'));
app.use('/api/identity/*', entrypointOwner('Identity'));

app.post('/api/billing/checkout', async (c) => {
  const body = await c.req.json().catch(() => ({ amount: 0 }));
  return c.json(await checkout(Number(body.amount)));
});

app.get('/api/identity/me', async (c) => c.json(await profile()));

serve({ fetch: app.fetch, port: 3000 }, () => {
  console.log('hono + otel example listening on :3000');
});
