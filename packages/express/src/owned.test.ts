import { describe, expect, it } from 'bun:test';
import { currentOwner } from '@strays/runtime/currentOwner';
import { runWithOwner } from '@strays/runtime/runWithOwner';
import { owned } from './owned.ts';

describe('owned (Express middleware)', () => {
  it('runs the rest of the chain inside a runWithOwner scope', () => {
    const middleware = owned('Billing');
    let observed: string | undefined;

    middleware({}, {}, () => {
      observed = currentOwner();
    });

    expect(observed).toBe('Billing');
  });

  it('preserves the scope across awaits in downstream async handlers', async () => {
    const middleware = owned('Identity');
    const samples: Array<string | undefined> = [];

    await new Promise<void>((resolve) => {
      middleware({}, {}, async () => {
        samples.push(currentOwner());
        await Promise.resolve();
        samples.push(currentOwner());
        await new Promise((r) => setTimeout(r, 0));
        samples.push(currentOwner());
        resolve();
      });
    });

    expect(samples).toEqual(['Identity', 'Identity', 'Identity']);
  });

  it('shadows an outer runWithOwner scope', () => {
    const middleware = owned('Inner');
    let inside: string | undefined;
    let after: string | undefined;

    runWithOwner('Outer', () => {
      middleware({}, {}, () => {
        inside = currentOwner();
      });
      after = currentOwner();
    });

    expect(inside).toBe('Inner');
    expect(after).toBe('Outer');
  });

  it('does not leak the scope past the next() call', () => {
    const middleware = owned('Billing');
    middleware({}, {}, () => {});
    expect(currentOwner()).toBeUndefined();
  });

  it('keeps the scope active when downstream calls next(err)', () => {
    const middleware = owned('Billing');
    let teamAtError: string | undefined;
    let forwardedError: unknown;

    middleware({}, {}, () => {
      // simulate a downstream handler signaling an error to the next layer
      const err = new Error('boom');
      const errorHandler = (e?: unknown) => {
        teamAtError = currentOwner();
        forwardedError = e;
      };
      errorHandler(err);
    });

    expect(teamAtError).toBe('Billing');
    expect(forwardedError).toBeInstanceOf(Error);
    expect((forwardedError as Error).message).toBe('boom');
  });

  it('different teams yield different scopes when chained', () => {
    const billing = owned('Billing');
    const identity = owned('Identity');
    const observed: Array<string | undefined> = [];

    billing({}, {}, () => {
      observed.push(currentOwner());
      identity({}, {}, () => {
        observed.push(currentOwner());
      });
      observed.push(currentOwner());
    });

    expect(observed).toEqual(['Billing', 'Identity', 'Billing']);
  });
});
