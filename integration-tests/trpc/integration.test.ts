import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { initTRPC, TRPCError } from '@trpc/server';
import type { AnyTRPCMiddlewareFunction, TRPCProcedureBuilder } from '@trpc/server';
import { createLogger } from '@strays/core/logging/createLogger';
import { currentEntrypointOwner } from '@strays/core/ownership';
import {
  captureStructuredLogs,
  type CapturedLogs,
} from '@strays/test-utils/captureStructuredLogs';
import { entrypointProcedure } from '@strays/trpc/ownedProcedure';
import { entrypointOwner } from '@strays/trpc/ownerMiddleware';

// A real tRPC server / caller harness. We exercise the middleware through the
// public procedure builder API the README documents (`entrypointProcedure(builder,
// owner)`), then assert that logs emitted from inside the handler carry the
// procedure's owner as the `team` field.
//
// Type note: `@strays/trpc`'s `entrypointOwner` is structurally typed against
// any framework whose middleware shape is `({ next }) => Promise<unknown>`.
// tRPC v11's `MiddlewareFunction` has a stricter return type
// (`Promise<MiddlewareResult>`), so we cast at the boundary. At runtime tRPC
// just awaits the value `next()` returns, which is exactly what our wrapper
// forwards through `runWithEntrypointOwner`. The cast is the price of keeping the
// strays middleware framework-agnostic.

const t = initTRPC.create();

// `entrypointProcedure(t.procedure, owner)` mutates and returns the same builder
// instance, but its public signature returns the structural
// `TrpcProcedureBuilder` (which has only `.use`). We adapt to tRPC's typed
// builder so the rest of the test can use `.query` / `.mutation` directly.
type AnyProcedureBuilder = TRPCProcedureBuilder<
  // deno-lint-ignore no-explicit-any -- structural escape hatch for `T extends`
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  boolean
>;

function tagged<T extends AnyProcedureBuilder>(builder: T, owner: string): T {
  return entrypointProcedure(builder as never, owner) as never;
}

const useOwner = (owner: string): AnyTRPCMiddlewareFunction =>
  entrypointOwner(owner) as never;

let capture: CapturedLogs;

beforeEach(() => {
  capture = captureStructuredLogs();
});

afterEach(() => {
  capture.restore();
});

describe('integration: real @trpc/server router + entrypointProcedure', () => {
  it('1. single mutation tags logs with the procedure owner', async () => {
    const log = createLogger('');

    const router = t.router({
      charge: tagged(t.procedure, 'Billing').mutation(() => {
        log.info({ msg: 'charging' });
        return { ok: true } as const;
      }),
    });

    const caller = router.createCaller({});
    const result = await caller.charge();

    expect(result).toEqual({ ok: true });
    const charging = capture.entries.find((e) => e.line.record['msg'] === 'charging');
    expect(charging).toBeDefined();
    expect(charging?.line.team).toBe('Billing');
  });

  it('2. async mutation persists the owner scope across awaits', async () => {
    const log = createLogger('');
    const observed: Array<string | undefined> = [];

    const router = t.router({
      slowCharge: tagged(t.procedure, 'Billing').mutation(async () => {
        observed.push(currentEntrypointOwner());
        await new Promise((resolve) => setTimeout(resolve, 1));
        observed.push(currentEntrypointOwner());
        log.info({ msg: 'slow-charged' });
        return { ok: true } as const;
      }),
    });

    await router.createCaller({}).slowCharge();

    expect(observed).toEqual(['Billing', 'Billing']);
    const entry = capture.entries.find((e) => e.line.record['msg'] === 'slow-charged');
    expect(entry?.line.team).toBe('Billing');
  });

  it('3. query and mutation with different owners do not cross-contaminate', async () => {
    const log = createLogger('');

    const router = t.router({
      getUser: tagged(t.procedure, 'Identity').query(() => {
        log.info({ msg: 'getting-user' });
        return { id: 'u1' } as const;
      }),
      charge: tagged(t.procedure, 'Billing').mutation(() => {
        log.info({ msg: 'charging' });
        return { ok: true } as const;
      }),
    });

    const caller = router.createCaller({});
    // Interleave to ensure scopes do not leak between calls.
    await Promise.all([caller.getUser(), caller.charge(), caller.getUser()]);

    expect(currentEntrypointOwner()).toBeUndefined();

    const userEntries = capture.entries.filter(
      (e) => e.line.record['msg'] === 'getting-user',
    );
    const chargeEntries = capture.entries.filter(
      (e) => e.line.record['msg'] === 'charging',
    );

    expect(userEntries).toHaveLength(2);
    expect(chargeEntries).toHaveLength(1);
    for (const e of userEntries) expect(e.line.team).toBe('Identity');
    for (const e of chargeEntries) expect(e.line.team).toBe('Billing');
  });

  it('4. nested sub-router carries its own owner', async () => {
    const log = createLogger('');

    const billingRouter = t.router({
      charge: tagged(t.procedure, 'Billing').mutation(() => {
        log.info({ msg: 'billing-charge' });
        return { ok: true } as const;
      }),
    });

    const identityRouter = t.router({
      whoami: tagged(t.procedure, 'Identity').query(() => {
        log.info({ msg: 'identity-whoami' });
        return { who: 'me' } as const;
      }),
    });

    const root = t.router({
      billing: billingRouter,
      identity: identityRouter,
    });

    const caller = root.createCaller({});
    await caller.billing.charge();
    await caller.identity.whoami();

    const billing = capture.entries.find((e) => e.line.record['msg'] === 'billing-charge');
    const identity = capture.entries.find(
      (e) => e.line.record['msg'] === 'identity-whoami',
    );

    expect(billing?.line.team).toBe('Billing');
    expect(identity?.line.team).toBe('Identity');
  });

  it('5. batched calls via the in-memory caller preserve per-call owners', async () => {
    // tRPC's `httpBatchLink` is a transport-level concern: it serialises
    // multiple operations into one HTTP POST. It cannot be exercised without
    // an HTTP transport — `createCaller` deliberately bypasses links, and
    // the fetch adapter would require us to build a server + custom fetch
    // shim here. The owner-scope guarantee we care about is per-procedure
    // AsyncLocalStorage isolation, which behaves identically whether calls
    // arrive batched or one at a time. We simulate the batching surface by
    // firing many concurrent calls through a single caller and asserting
    // each handler runs under its own owner without bleed.
    const log = createLogger('');

    const router = t.router({
      a: tagged(t.procedure, 'Billing').query(() => {
        log.info({ msg: 'a' });
        return 'a' as const;
      }),
      b: tagged(t.procedure, 'Identity').query(() => {
        log.info({ msg: 'b' });
        return 'b' as const;
      }),
      c: tagged(t.procedure, 'Platform').query(() => {
        log.info({ msg: 'c' });
        return 'c' as const;
      }),
    });

    const caller = router.createCaller({});
    const results = await Promise.all([
      caller.a(),
      caller.b(),
      caller.c(),
      caller.a(),
      caller.b(),
    ]);

    expect(results).toEqual(['a', 'b', 'c', 'a', 'b']);

    const byOwner = new Map<string, string[]>();
    for (const e of capture.entries) {
      const msg = e.line.record['msg'] as string;
      if (msg !== 'a' && msg !== 'b' && msg !== 'c') continue;
      const list = byOwner.get(e.line.team) ?? [];
      list.push(msg);
      byOwner.set(e.line.team, list);
    }

    expect(byOwner.get('Billing')).toEqual(['a', 'a']);
    expect(byOwner.get('Identity')).toEqual(['b', 'b']);
    expect(byOwner.get('Platform')).toEqual(['c']);
  });

  it('6. error path: thrown errors still see the owner before propagating', async () => {
    const log = createLogger('');
    let ownerSeenAtThrow: string | undefined;

    const router = t.router({
      boom: tagged(t.procedure, 'Billing').mutation(() => {
        ownerSeenAtThrow = currentEntrypointOwner();
        log.error({ msg: 'about-to-throw' }, new Error('boom'));
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'boom' });
      }),
    });

    const caller = router.createCaller({});

    let caught: unknown;
    try {
      await caller.boom();
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(TRPCError);
    expect((caught as TRPCError).message).toBe('boom');
    expect(ownerSeenAtThrow).toBe('Billing');
    // Scope must unwind cleanly past the thrown error.
    expect(currentEntrypointOwner()).toBeUndefined();

    const errEntry = capture.entries.find(
      (e) => e.line.record['msg'] === 'about-to-throw',
    );
    expect(errEntry?.line.team).toBe('Billing');
    expect(errEntry?.level).toBe('error');
  });

  it('exposes the raw entrypointOwner via .use() on a builder', async () => {
    const log = createLogger('');

    const router = t.router({
      ping: t.procedure.use(useOwner('Platform')).query(() => {
        log.info({ msg: 'pinged' });
        return 'pong' as const;
      }),
    });

    const result = await router.createCaller({}).ping();
    expect(result).toBe('pong');

    const pinged = capture.entries.find((e) => e.line.record['msg'] === 'pinged');
    expect(pinged?.line.team).toBe('Platform');
  });
});
