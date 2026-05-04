import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import express, { type NextFunction, type Request, type Response, Router } from 'express';
import request from 'supertest';
import { captureStructuredLogs, type CapturedLogs } from '@strays/test-utils/captureStructuredLogs';
import { createLogger } from '@strays/runtime/logging/createLogger';
import { currentOwner } from '@strays/runtime/scope/currentOwner';
import { ownerMiddleware } from '@strays/express/ownerMiddleware';

// Each handler logs once with `msg` echoing the per-request marker so the test
// can correlate logs to the request that emitted them. The `team` field on the
// captured log line is what we assert: it reflects the resolved owner at the
// instant the log was written.
//
// `createLogger` snapshots `getDefaultLogSink()` at construction time, so the
// logger has to be built *after* `captureStructuredLogs()` swaps the sink in.
// We rebuild it per test in `beforeEach`.
let logger: ReturnType<typeof createLogger>;

describe('@strays/express integration (real Express + supertest)', () => {
  let logs: CapturedLogs;

  beforeEach(() => {
    logs = captureStructuredLogs();
    logger = createLogger('');
  });

  afterEach(() => {
    logs.restore();
  });

  it('per-route middleware tags logs with the route owner', async () => {
    const app = express();
    app.get('/charge', ownerMiddleware('Billing'), (_req: Request, res: Response) => {
      logger.info({ msg: 'charge:hit' });
      res.status(200).json({ ok: true });
    });

    const response = await request(app).get('/charge');

    expect(response.status).toBe(200);
    const entry = logs.entries.find((e) => e.line.record.msg === 'charge:hit');
    expect(entry).toBeDefined();
    expect(entry?.line.team).toBe('Billing');
  });

  it('per-router middleware tags every sub-route mounted under it', async () => {
    const billingRouter = Router();
    billingRouter.use(ownerMiddleware('Billing'));
    billingRouter.get('/charge', (_req: Request, res: Response) => {
      logger.info({ msg: 'router:charge' });
      res.status(200).json({ ok: true });
    });
    billingRouter.get('/refund', (_req: Request, res: Response) => {
      logger.info({ msg: 'router:refund' });
      res.status(200).json({ ok: true });
    });

    const app = express();
    app.use('/billing', billingRouter);

    const chargeRes = await request(app).get('/billing/charge');
    const refundRes = await request(app).get('/billing/refund');

    expect(chargeRes.status).toBe(200);
    expect(refundRes.status).toBe(200);

    const chargeEntry = logs.entries.find((e) => e.line.record.msg === 'router:charge');
    const refundEntry = logs.entries.find((e) => e.line.record.msg === 'router:refund');
    expect(chargeEntry?.line.team).toBe('Billing');
    expect(refundEntry?.line.team).toBe('Billing');
  });

  it('preserves the ALS scope across `await` in async handlers', async () => {
    const app = express();
    app.get('/async', ownerMiddleware('Billing'), async (_req: Request, res: Response) => {
      // Yield to the microtask queue, then to a macrotask, then assert the
      // owner is still observable via ALS.
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 5));
      const ownerAfterAwait = currentOwner();
      logger.info({ msg: 'async:hit', ownerAfterAwait: ownerAfterAwait ?? null });
      res.status(200).json({ ok: true });
    });

    const response = await request(app).get('/async');

    expect(response.status).toBe(200);
    const entry = logs.entries.find((e) => e.line.record.msg === 'async:hit');
    expect(entry).toBeDefined();
    expect(entry?.line.team).toBe('Billing');
    expect(entry?.line.record.ownerAfterAwait).toBe('Billing');
  });

  it('error middleware still observes the owner when handlers call next(err)', async () => {
    const app = express();
    app.get('/boom', ownerMiddleware('Billing'), (_req: Request, _res: Response, next: NextFunction) => {
      // Force an async hop before raising, to prove ALS survives the boundary
      // between the handler and the error middleware Express dispatches to.
      setTimeout(() => next(new Error('kaboom')), 1);
    });

    app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      logger.error({ msg: 'error:handler' }, err);
      const status = 500;
      res.status(status).json({ ok: false });
    });

    const response = await request(app).get('/boom');

    expect(response.status).toBe(500);
    const entry = logs.entries.find((e) => e.line.record.msg === 'error:handler');
    expect(entry).toBeDefined();
    expect(entry?.line.team).toBe('Billing');
  });

  it('handles 50 concurrent mixed-prefix requests without cross-contamination', async () => {
    const app = express();

    const billingRouter = Router();
    billingRouter.use(ownerMiddleware('Billing'));
    billingRouter.get('/op', async (req: Request, res: Response) => {
      // Random async stagger to maximise interleaving across handlers.
      await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 8)));
      const marker = String(req.query.id);
      logger.info({ msg: 'concurrent', expected: 'Billing', marker });
      res.status(200).json({ ok: true });
    });

    const platformRouter = Router();
    platformRouter.use(ownerMiddleware('Platform'));
    platformRouter.get('/op', async (req: Request, res: Response) => {
      await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 8)));
      const marker = String(req.query.id);
      logger.info({ msg: 'concurrent', expected: 'Platform', marker });
      res.status(200).json({ ok: true });
    });

    app.use('/billing', billingRouter);
    app.use('/platform', platformRouter);

    const total = 50;
    const requests = Array.from({ length: total }, (_value, index) => {
      const isBilling = index % 2 === 0;
      const prefix = isBilling ? '/billing/op' : '/platform/op';
      return request(app).get(prefix).query({ id: String(index) });
    });

    const responses = await Promise.all(requests);
    expect(responses.every((r) => r.status === 200)).toBe(true);

    const concurrentEntries = logs.entries.filter((e) => e.line.record.msg === 'concurrent');
    expect(concurrentEntries).toHaveLength(total);

    for (const entry of concurrentEntries) {
      expect(entry.line.team).toBe(entry.line.record.expected);
    }

    const billingCount = concurrentEntries.filter((e) => e.line.team === 'Billing').length;
    const platformCount = concurrentEntries.filter((e) => e.line.team === 'Platform').length;
    expect(billingCount).toBe(total / 2);
    expect(platformCount).toBe(total / 2);
  });

  it('with nested routers, the innermost owner wins', async () => {
    const innerRouter = Router();
    innerRouter.use(ownerMiddleware('Billing'));
    innerRouter.get('/charge', (_req: Request, res: Response) => {
      logger.info({ msg: 'nested:inner' });
      res.status(200).json({ ok: true });
    });

    const outerRouter = Router();
    outerRouter.use(ownerMiddleware('Platform'));
    outerRouter.get('/health', (_req: Request, res: Response) => {
      logger.info({ msg: 'nested:outer' });
      res.status(200).json({ ok: true });
    });
    outerRouter.use('/billing', innerRouter);

    const app = express();
    app.use('/api', outerRouter);

    const innerResponse = await request(app).get('/api/billing/charge');
    const outerResponse = await request(app).get('/api/health');

    expect(innerResponse.status).toBe(200);
    expect(outerResponse.status).toBe(200);

    const innerEntry = logs.entries.find((e) => e.line.record.msg === 'nested:inner');
    const outerEntry = logs.entries.find((e) => e.line.record.msg === 'nested:outer');
    expect(innerEntry?.line.team).toBe('Billing');
    expect(outerEntry?.line.team).toBe('Platform');
  });
});
