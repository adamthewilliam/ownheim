import { describe, expect, it } from 'bun:test';
import { currentOwner } from './currentOwner.ts';
import { runWithOwner } from './runWithOwner.ts';
import { withOwnerScope } from './withOwnerScope.ts';

describe('withOwnerScope', () => {
  it('runs the thunk returned by pickNext with currentOwner() === owner', () => {
    const factory = withOwnerScope<[() => unknown], unknown>((next) => next);
    let observed: string | undefined;

    factory('Billing')(() => {
      observed = currentOwner();
    });

    expect(observed).toBe('Billing');
  });

  it("returns the thunk's value verbatim (sync and Promise)", async () => {
    const sync = withOwnerScope<[() => unknown], unknown>((next) => next);
    expect(sync('Billing')(() => 42)).toBe(42);

    const asyncFactory = withOwnerScope<[() => Promise<unknown>], Promise<unknown>>(
      (next) => next,
    );
    const result = await asyncFactory('Billing')(async () => ({ ok: true, n: 7 }));
    expect(result).toEqual({ ok: true, n: 7 });
  });

  it('does not leak the scope past a synchronous thunk', () => {
    const factory = withOwnerScope<[() => unknown], unknown>((next) => next);
    factory('Billing')(() => undefined);
    expect(currentOwner()).toBeUndefined();
  });

  it('preserves the scope across await boundaries inside the thunk', async () => {
    const factory = withOwnerScope<[() => Promise<unknown>], Promise<unknown>>(
      (next) => next,
    );
    const samples: Array<string | undefined> = [];

    await factory('Identity')(async () => {
      samples.push(currentOwner());
      await Promise.resolve();
      samples.push(currentOwner());
      await new Promise((resolve) => setTimeout(resolve, 0));
      samples.push(currentOwner());
    });

    expect(samples).toEqual(['Identity', 'Identity', 'Identity']);
  });

  it('nested invocations shadow the outer scope and unwind correctly', async () => {
    const factory = withOwnerScope<[() => Promise<unknown>], Promise<unknown>>(
      (next) => next,
    );
    let inside: string | undefined;
    let after: string | undefined;

    await runWithOwner('Outer', async () => {
      await factory('Inner')(async () => {
        inside = currentOwner();
      });
      after = currentOwner();
    });

    expect(inside).toBe('Inner');
    expect(after).toBe('Outer');
  });

  it('propagates errors thrown by the thunk without leaking the scope', async () => {
    const factory = withOwnerScope<[() => Promise<unknown>], Promise<unknown>>(
      (next) => next,
    );
    let observedDuringError: string | undefined;

    const failing = factory('Billing')(async () => {
      observedDuringError = currentOwner();
      throw new Error('boom');
    });

    await expect(failing).rejects.toThrow('boom');
    expect(observedDuringError).toBe('Billing');
    expect(currentOwner()).toBeUndefined();
  });
});
