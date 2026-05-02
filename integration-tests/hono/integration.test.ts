import { afterEach, describe, expect, it } from 'bun:test';
import { createLogger } from '@strays/runtime/createLogger';
import { currentOwner } from '@strays/runtime/currentOwner';
import { captureStructuredLogs } from '@strays/test-utils/captureStructuredLogs';
import { Hono } from 'hono';
import { ownerMiddleware } from '@strays/hono/ownerMiddleware';

// The middleware factory in src/ownerMiddleware.ts is typed against an arbitrary
// `(c, next) => Promise<void>` shape; Hono's actual middleware signature is the
// same positionally so we cast at the call site to keep Hono's typing happy.
type HonoMiddleware = Parameters<Hono['use']>[1];
const honoOwnerMiddleware = (owner: string): HonoMiddleware =>
  ownerMiddleware(owner) as unknown as HonoMiddleware;

// Per @strays/runtime/formatOwnedLogEntry the `team` field is the OwnerId
// verbatim (e.g. 'Billing'), not lowercased — the prompt's `'billing'`
// expectation predates that rename.

describe('hono ownerMiddleware integration (real Hono server)', () => {
  let activeCapture: ReturnType<typeof captureStructuredLogs> | undefined;

  const startCapture = () => {
    const capture = captureStructuredLogs();
    activeCapture = capture;
    return capture;
  };

  afterEach(() => {
    activeCapture?.restore();
    activeCapture = undefined;
  });

  it('per-route middleware tags logs from a sync handler', async () => {
    const capture = startCapture();
    const log = createLogger('Billing');

    const app = new Hono();
    app.use('/charge', honoOwnerMiddleware('Billing'));
    app.get('/charge', (c) => {
      log.info({ msg: 'charging' });
      return c.json({ ok: true });
    });

    const res = await app.request('/charge');
    expect(res.status).toBe(200);
    const charging = capture.entries.find((e) => e.line.record.msg === 'charging');
    expect(charging).toBeDefined();
    expect(charging?.line.team).toBe('Billing');
  });

  it('preserves owner scope across multiple awaits in an async handler', async () => {
    const capture = startCapture();
    const log = createLogger('Billing');

    const app = new Hono();
    app.use('/charge', honoOwnerMiddleware('Billing'));
    app.get('/charge', async (c) => {
      await Promise.resolve();
      log.info({ msg: 'after-microtask', step: 1 });
      await new Promise((resolve) => setTimeout(resolve, 1));
      log.info({ msg: 'after-macrotask', step: 2 });
      await Promise.resolve().then(async () => {
        await Promise.resolve();
        log.info({ msg: 'after-nested', step: 3 });
      });
      return c.json({ ok: true });
    });

    const res = await app.request('/charge');
    expect(res.status).toBe(200);

    const observed = capture.entries
      .filter((e) =>
        ['after-microtask', 'after-macrotask', 'after-nested'].includes(
          e.line.record.msg as string,
        ),
      )
      .map((e) => e.line.team);

    expect(observed).toEqual(['Billing', 'Billing', 'Billing']);
  });

  it('per-prefix middleware tags multiple sub-routes under the same owner', async () => {
    const capture = startCapture();
    const billingLog = createLogger('Billing');

    const app = new Hono();
    app.use('/billing/*', honoOwnerMiddleware('Billing'));
    app.get('/billing/charge', async (c) => {
      await Promise.resolve();
      billingLog.info({ msg: 'charge', amount: 100 });
      return c.json({ ok: true });
    });
    app.get('/billing/refund', async (c) => {
      await Promise.resolve();
      billingLog.info({ msg: 'refund', amount: 50 });
      return c.json({ ok: true });
    });

    const [chargeRes, refundRes] = await Promise.all([
      app.request('/billing/charge'),
      app.request('/billing/refund'),
    ]);
    expect(chargeRes.status).toBe(200);
    expect(refundRes.status).toBe(200);

    const chargeEntry = capture.entries.find((e) => e.line.record.msg === 'charge');
    const refundEntry = capture.entries.find((e) => e.line.record.msg === 'refund');
    expect(chargeEntry?.line.team).toBe('Billing');
    expect(refundEntry?.line.team).toBe('Billing');
  });

  it('nested ownerMiddleware: innermost owner wins for handler logs', async () => {
    const capture = startCapture();
    const log = createLogger('Billing');

    const app = new Hono();
    app.use('/inner', honoOwnerMiddleware('Billing'));
    app.use('/inner', honoOwnerMiddleware('Identity'));
    app.get('/inner', async (c) => {
      await Promise.resolve();
      log.info({ msg: 'innermost-wins' });
      return c.json({ ok: true });
    });

    const res = await app.request('/inner');
    expect(res.status).toBe(200);

    const entry = capture.entries.find((e) => e.line.record.msg === 'innermost-wins');
    // ALS shadowing: the second `runWithOwner('Identity', ...)` runs inside the
    // first scope, and `currentOwner()` inside the handler reflects the
    // innermost scope. This locks the documented `runWithOwner` shadowing
    // behaviour through the hono middleware chain.
    expect(entry?.line.team).toBe('Identity');
  });

  it('handler error: error handler runs but the failed-request log keeps the owner scope', async () => {
    const capture = startCapture();
    const log = createLogger('Billing');

    const app = new Hono();
    app.use('/boom', honoOwnerMiddleware('Billing'));
    app.get('/boom', async () => {
      await Promise.resolve();
      throw new Error('boom from handler');
    });
    app.onError((err, c) => {
      // Hono runs onError synchronously after the handler rejects, while we
      // are still inside the middleware's `runWithOwner` frame, so the scope
      // is still 'Billing'.
      log.error({ msg: 'request failed', scopeAtErrorHandler: currentOwner() }, err);
      return c.json({ error: String(err) }, 500);
    });

    const res = await app.request('/boom');
    expect(res.status).toBe(500);

    const entry = capture.entries.find((e) => e.line.record.msg === 'request failed');
    expect(entry).toBeDefined();
    expect(entry?.line.team).toBe('Billing');
    expect(entry?.line.record.scopeAtErrorHandler).toBe('Billing');
  });

  it('50 concurrent requests across two prefixes do not cross-contaminate owners', async () => {
    const capture = startCapture();
    const billingLog = createLogger('Billing');
    const identityLog = createLogger('Identity');

    const app = new Hono();
    app.use('/billing/*', honoOwnerMiddleware('Billing'));
    app.use('/identity/*', honoOwnerMiddleware('Identity'));

    app.get('/billing/charge/:id', async (c) => {
      const id = c.req.param('id');
      // Two awaits with jitter so handlers interleave in the event loop.
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));
      await Promise.resolve();
      billingLog.info({ msg: 'concurrent', id, prefix: 'billing' });
      return c.json({ ok: true, id });
    });
    app.get('/identity/login/:id', async (c) => {
      const id = c.req.param('id');
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));
      await Promise.resolve();
      identityLog.info({ msg: 'concurrent', id, prefix: 'identity' });
      return c.json({ ok: true, id });
    });

    const requests: Array<Promise<Response> | Response> = [];
    for (let i = 0; i < 25; i++) {
      requests.push(app.request(`/billing/charge/${i}`));
      requests.push(app.request(`/identity/login/${i}`));
    }
    const results = await Promise.all(requests);
    expect(results.every((r) => r.status === 200)).toBe(true);

    const concurrent = capture.entries.filter((e) => e.line.record.msg === 'concurrent');
    expect(concurrent.length).toBe(50);

    let billingCount = 0;
    let identityCount = 0;
    for (const entry of concurrent) {
      const prefix = entry.line.record.prefix as string;
      const team = entry.line.team;
      if (prefix === 'billing') {
        expect(team).toBe('Billing');
        billingCount++;
      } else if (prefix === 'identity') {
        expect(team).toBe('Identity');
        identityCount++;
      }
    }
    expect(billingCount).toBe(25);
    expect(identityCount).toBe(25);
  });
});
