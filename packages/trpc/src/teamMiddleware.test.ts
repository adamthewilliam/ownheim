import { describe, expect, it } from 'bun:test';
import { currentOwner } from '@strays/runtime/currentOwner';
import { runWithOwner } from '@strays/runtime/runWithOwner';
import { teamMiddleware } from './teamMiddleware.ts';

describe('teamMiddleware', () => {
  it('runs next() inside a runWithOwner scope', async () => {
    const middleware = teamMiddleware('Billing');
    let observed: string | undefined;

    await middleware({
      next: async () => {
        observed = currentOwner();
        return { ok: true };
      },
    });

    expect(observed).toBe('Billing');
  });

  it('preserves the scope across awaits inside next()', async () => {
    const middleware = teamMiddleware('Identity');
    const samples: Array<string | undefined> = [];

    await middleware({
      next: async () => {
        samples.push(currentOwner());
        await Promise.resolve();
        samples.push(currentOwner());
        await new Promise((resolve) => setTimeout(resolve, 0));
        samples.push(currentOwner());
        return { ok: true };
      },
    });

    expect(samples).toEqual(['Identity', 'Identity', 'Identity']);
  });

  it('returns whatever next() returns', async () => {
    const middleware = teamMiddleware('Billing');
    const result = await middleware({
      next: async () => ({ ok: true, data: 42 }),
    });

    expect(result).toEqual({ ok: true, data: 42 });
  });

  it('shadows an outer scope for the duration of next()', async () => {
    const middleware = teamMiddleware('Inner');
    let inside: string | undefined;
    let after: string | undefined;

    await runWithOwner('Outer', async () => {
      await middleware({
        next: async () => {
          inside = currentOwner();
          return { ok: true };
        },
      });
      after = currentOwner();
    });

    expect(inside).toBe('Inner');
    expect(after).toBe('Outer');
  });

  it('does not leak the scope past next()', async () => {
    const middleware = teamMiddleware('Billing');
    await middleware({ next: async () => ({ ok: true }) });
    expect(currentOwner()).toBeUndefined();
  });
});
