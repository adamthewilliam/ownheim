import express from 'express';
import pino from 'pino';
import * as Sentry from '@sentry/node';
import { registerOwnershipManifest } from '@ownheim/core/manifest/defaultRegistry';
import { entrypointOwner } from '@ownheim/express';
import { ownershipFromError, ownershipMixin } from '@ownheim/pino';
import { instrumentSentry } from '@ownheim/sentry';
import { chargeCustomer } from './billing/charge.ts';
import { requireUser } from './identity/session.ts';

// Generate this with: bun run generate
const manifestPath = new URL('../dist/ownheim-manifest.json', import.meta.url);
try {
  const manifest = await import(manifestPath.href, { with: { type: 'json' } });
  registerOwnershipManifest(manifest.default);
} catch {
  // The example still demonstrates entrypoint/responder ownership before generation.
}

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN });
  instrumentSentry(Sentry.getClient()!);
}

const logger = pino({ mixin: ownershipMixin({ fallbackCodeTeam: 'Platform' }) });
const app = express();
app.use(express.json());

const billingRouter = express.Router();
billingRouter.use(entrypointOwner('Billing'));
billingRouter.post('/charge', (req, res, next) => {
  void new Promise<void>((resolve, reject) => {
    chargeCustomer(Number(req.body.amount))
      .then((payment) => {
        logger.info({ payment }, 'charged customer');
        res.json(payment);
        resolve();
      })
      .catch(reject);
  }).catch(next);
});

const identityRouter = express.Router();
identityRouter.use(entrypointOwner('Identity'));
identityRouter.get('/me', (req, res) => {
  const user = requireUser(req.header('authorization'));
  logger.info({ user }, 'loaded current user');
  res.json(user);
});

app.use('/api/billing', billingRouter);
app.use('/api/identity', identityRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err: error, ...ownershipFromError(error) }, 'request failed');
  Sentry.captureException(error);
  res.status(500).json({ error: String(error) });
});

app.listen(3000, () => logger.info('express example listening on :3000'));
