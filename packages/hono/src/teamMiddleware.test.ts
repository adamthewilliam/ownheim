import { describe, expect, it } from 'bun:test';
import { currentOwner } from '@strays/runtime/currentOwner';
import { runWithOwner } from '@strays/runtime/runWithOwner';
import { teamMiddleware } from './teamMiddleware.ts';

const stubContext = {};

describe('teamMiddleware (Hono)', () => {
  it('runs next() inside a runWithOwner scope', async () => {
    const middleware = teamMiddleware('Billing');
    let observed: string | undefined;

    await middleware(stubContext, async () => {
      observed = currentOwner();
    });

    expect(observed).toBe('Billing');
  });

  it('preserves the scope across awaits inside next()', async () => {
    const middleware = teamMiddleware('Identity');
    const samples: Array<string | undefined> = [];

    await middleware(stubContext, async () => {
      samples.push(currentOwner());
      await Promise.resolve();
      samples.push(currentOwner());
      await new Promise((resolve) => setTimeout(resolve, 0));
      samples.push(currentOwner());
    });

    expect(samples).toEqual(['Identity', 'Identity', 'Identity']);
  });

  it('shadows an outer scope for the duration of next()', async () => {
    const middleware = teamMiddleware('Inner');
    let inside: string | undefined;
    let after: string | undefined;

    await runWithOwner('Outer', async () => {
      await middleware(stubContext, async () => {
        inside = currentOwner();
      });
      after = currentOwner();
    });

    expect(inside).toBe('Inner');
    expect(after).toBe('Outer');
  });

  it('does not leak the scope past next()', async () => {
    const middleware = teamMiddleware('Billing');
    await middleware(stubContext, async () => {});
    expect(currentOwner()).toBeUndefined();
  });

  it('works as a path-mounted middleware (simulated chain)', async () => {
    const billingMw = teamMiddleware('Billing');
    const identityMw = teamMiddleware('Identity');
    const calls: Array<{ path: string; team: string | undefined }> = [];

    const handler = (path: string) => async () => {
      calls.push({ path, team: currentOwner() });
    };

    await billingMw(stubContext, handler('/billing/charge'));
    await identityMw(stubContext, handler('/identity/login'));

    expect(calls).toEqual([
      { path: '/billing/charge', team: 'Billing' },
      { path: '/identity/login', team: 'Identity' },
    ]);
  });
});
