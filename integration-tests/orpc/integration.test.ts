import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createRouterClient, os, type RouterClient } from '@orpc/server';
import { RPCHandler } from '@orpc/server/fetch';
import { BatchHandlerPlugin } from '@orpc/server/plugins';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { BatchLinkPlugin } from '@orpc/client/plugins';
import { createLogger } from '@strays/core/logging/createLogger';
import { currentOwner } from '@strays/core/ownership';
import { captureStructuredLogs, type CapturedLogs } from '@strays/test-utils/captureStructuredLogs';
import { ownedProcedure } from '@strays/orpc/ownedProcedure';
import { ownerMiddleware } from '@strays/orpc/ownerMiddleware';

// oRPC's `Builder.use` and `Builder.middleware` accept the rich
// `Middleware<TInContext, TOutContext, TInput, TOutput, ...>` signature, but
// our `ownerMiddleware` is structurally `({ next }) => Promise<unknown>`.
// The runtime contract is identical (call `next()` inside the owner ALS
// scope) and the README explicitly invites consumers to plug it into either
// `os.use(...)` or `ownedProcedure(...)`. We coerce through `unknown` at the
// boundary so the rest of the test stays oRPC-typed end-to-end.
type OsBuilder = typeof os;
const asOrpcMw = <Mw>(mw: Mw): Parameters<OsBuilder['use']>[0] =>
  mw as unknown as Parameters<OsBuilder['use']>[0];

const billingMw = asOrpcMw(ownerMiddleware('Billing'));
const identityMw = asOrpcMw(ownerMiddleware('Identity'));
const platformMw = asOrpcMw(ownerMiddleware('Platform'));

// Mirrors the `ownedProcedure(builder, owner)` factory in `src/`. We exercise
// it indirectly here (the structural builder it expects is incompatible with
// oRPC's overloaded `Builder.use` signatures, so a one-line cast is required
// either side of the call). `taggedOs(os, 'Owner')` is exactly what
// `ownedProcedure(os, 'Owner')` does at runtime.
const taggedOs = (builder: OsBuilder, owner: string): OsBuilder => {
  // Round-trip through `ownedProcedure` so this file actually exercises the
  // public factory, not just `ownerMiddleware`. Two coercions: one in to fit
  // oRPC's overloaded `Builder.use` into the package's narrower
  // `OrpcProcedureBuilder` shape, one out to recover `os`'s rich `.handler(...)`
  // typing. Runtime contract is identical.
  const tagged = ownedProcedure(
    builder as unknown as Parameters<typeof ownedProcedure>[0],
    owner,
  );
  return tagged as unknown as OsBuilder;
};

// `createLogger` snapshots the active default sink at construction time, so
// the logger MUST be built after `captureStructuredLogs()` installs its sink
// (i.e. inside `beforeEach`), otherwise it stays bound to `stdoutJsonSink`.
let logger: ReturnType<typeof createLogger>;
let captured: CapturedLogs;

beforeEach(() => {
  captured = captureStructuredLogs();
  logger = createLogger('');
});

afterEach(() => {
  captured.restore();
});

describe('@strays/orpc — real oRPC integration', () => {
  it('procedure middleware tags logs from the handler (in-memory router client)', async () => {
    const router = {
      charge: taggedOs(os, 'Billing').handler(() => {
        logger.info({ msg: 'charged', amount: 42 });
        return { ok: true as const };
      }),
    };

    const client = createRouterClient(router);
    await client.charge();

    const charged = captured.entries.filter((e) => e.line.record['msg'] === 'charged');
    expect(charged).toHaveLength(1);
    expect(charged[0]?.line.team).toBe('Billing');
    expect(charged[0]?.line.record['team']).toBe('Billing');
  });

  it('async procedure (with awaits) — owner ALS persists across async boundaries', async () => {
    const router = {
      slowCharge: taggedOs(os, 'Billing').handler(async () => {
        // Owner must survive the microtask boundary and a real timer.
        await Promise.resolve();
        await new Promise((r) => setTimeout(r, 5));
        logger.info({ msg: 'slow-charged' });
        await Promise.resolve();
        logger.warn({ msg: 'slow-charged-warn' });
        return { ownerAfterAwaits: currentOwner() };
      }),
    };

    const client = createRouterClient(router);
    const result = await client.slowCharge();

    expect(result.ownerAfterAwaits).toBe('Billing');

    const teamTags = captured.entries
      .filter((e) =>
        e.line.record['msg'] === 'slow-charged' || e.line.record['msg'] === 'slow-charged-warn',
      )
      .map((e) => e.line.team);
    expect(teamTags).toEqual(['Billing', 'Billing']);
  });

  it('multiple procedures with different owners — no leakage between sequential calls', async () => {
    const router = {
      charge: taggedOs(os, 'Billing').handler(() => {
        logger.info({ msg: 'tagged', from: 'charge' });
      }),
      getUser: taggedOs(os, 'Identity').handler(() => {
        logger.info({ msg: 'tagged', from: 'getUser' });
      }),
      health: taggedOs(os, 'Platform').handler(() => {
        logger.info({ msg: 'tagged', from: 'health' });
      }),
    };

    const client = createRouterClient(router);
    await client.charge();
    await client.getUser();
    await client.health();
    // Outside any procedure: owner must be undefined.
    expect(currentOwner()).toBeUndefined();

    const byCaller = new Map<string, string>();
    for (const entry of captured.entries) {
      if (entry.line.record['msg'] !== 'tagged') continue;
      const from = entry.line.record['from'] as string;
      byCaller.set(from, entry.line.team);
    }
    expect(byCaller.get('charge')).toBe('Billing');
    expect(byCaller.get('getUser')).toBe('Identity');
    expect(byCaller.get('health')).toBe('Platform');
  });

  it('nested calls: A (Billing) calls plain server-side B — B without its own middleware inherits A; B with its own middleware overrides', async () => {
    // Plain helpers an outer procedure invokes server-side. We cannot
    // recursively call into the same router's other procedures from a
    // handler without circular references, but the ALS contract is identical:
    // it's about whether `runWithOwner` is re-entered, regardless of whether
    // the inner callee is "an oRPC procedure" or "a plain function".
    const innerNoOwner = () => {
      logger.info({ msg: 'inner-no-owner', observed: currentOwner() ?? null });
    };

    const innerWithOwnScope = async () => {
      const before = currentOwner();
      await ownerMiddleware('Identity')({
        next: async () => {
          logger.info({ msg: 'inner-with-own', observed: currentOwner() ?? null });
        },
      });
      // After B exits, A's owner must be restored.
      expect(currentOwner()).toBe(before);
    };

    const router = {
      outer: taggedOs(os, 'Billing').handler(async () => {
        innerNoOwner();
        await innerWithOwnScope();
        logger.info({ msg: 'outer-after', observed: currentOwner() ?? null });
      }),
    };

    const client = createRouterClient(router);
    await client.outer();

    const innerNo = captured.entries.find((e) => e.line.record['msg'] === 'inner-no-owner');
    const innerOwn = captured.entries.find((e) => e.line.record['msg'] === 'inner-with-own');
    const outerAfter = captured.entries.find((e) => e.line.record['msg'] === 'outer-after');

    // B without its own middleware sees A's owner (ALS inheritance).
    expect(innerNo?.line.team).toBe('Billing');
    expect(innerNo?.line.record['observed']).toBe('Billing');

    // B with its own middleware overrides A.
    expect(innerOwn?.line.team).toBe('Identity');
    expect(innerOwn?.line.record['observed']).toBe('Identity');

    // After B exits, A's scope is intact.
    expect(outerAfter?.line.team).toBe('Billing');
    expect(outerAfter?.line.record['observed']).toBe('Billing');
  });

  it('raw `os.use(ownerMiddleware(...))` (without the ownedProcedure factory) tags logs identically', async () => {
    const router = {
      ping: os.use(billingMw).handler(() => {
        logger.info({ msg: 'pinged' });
        return 'pong' as const;
      }),
    };

    const client = createRouterClient(router);
    const out = await client.ping();
    expect(out).toBe('pong');

    const pinged = captured.entries.find((e) => e.line.record['msg'] === 'pinged');
    expect(pinged?.line.team).toBe('Billing');
  });

  it('batched calls over real HTTP transport — each entry carries its own team', async () => {
    const router = {
      billingOp: os.use(billingMw).handler(() => {
        logger.info({ msg: 'batched', proc: 'billingOp' });
        return { team: currentOwner() };
      }),
      identityOp: os.use(identityMw).handler(() => {
        logger.info({ msg: 'batched', proc: 'identityOp' });
        return { team: currentOwner() };
      }),
      platformOp: os.use(platformMw).handler(() => {
        logger.info({ msg: 'batched', proc: 'platformOp' });
        return { team: currentOwner() };
      }),
    };

    const handler = new RPCHandler(router, {
      plugins: [new BatchHandlerPlugin()],
    });

    type Client = RouterClient<typeof router>;
    const link = new RPCLink<Record<never, never>>({
      url: 'http://in-memory.test/rpc',
      // Wire the client straight into the server's fetch handler — no real
      // socket, no port, no Bun.serve. Pure in-process.
      fetch: async (req) => {
        const result = await handler.handle(req, { prefix: '/rpc' });
        return result.matched ? result.response : new Response('Not Found', { status: 404 });
      },
      plugins: [
        new BatchLinkPlugin({
          groups: [{ condition: () => true, context: {} }],
        }),
      ],
    });

    const client = createORPCClient<Client>(link);

    // Fire all three concurrently — BatchLinkPlugin coalesces them into a
    // single HTTP request. The server-side BatchHandlerPlugin fans them out
    // to the matched procedures.
    const [billingResult, identityResult, platformResult] = await Promise.all([
      client.billingOp(),
      client.identityOp(),
      client.platformOp(),
    ]);

    // Each handler observed its own scope owner.
    expect(billingResult.team).toBe('Billing');
    expect(identityResult.team).toBe('Identity');
    expect(platformResult.team).toBe('Platform');

    // Each log entry carries its own team — no cross-contamination from the
    // shared HTTP entry point.
    const byProc = new Map<string, string>();
    for (const entry of captured.entries) {
      if (entry.line.record['msg'] !== 'batched') continue;
      const proc = entry.line.record['proc'] as string;
      byProc.set(proc, entry.line.team);
    }
    expect(byProc.get('billingOp')).toBe('Billing');
    expect(byProc.get('identityOp')).toBe('Identity');
    expect(byProc.get('platformOp')).toBe('Platform');

    // Outside the batch, no scope leaks.
    expect(currentOwner()).toBeUndefined();
  });
});
