import { describe, expect, it } from 'bun:test';
import { currentOwner } from './currentOwner.ts';
import { runWithOwner } from './runWithOwner.ts';

describe('runWithOwner / currentOwner', () => {
  it('returns undefined outside any scope', () => {
    expect(currentOwner()).toBeUndefined();
  });

  it('exposes the scope owner inside the callback', () => {
    runWithOwner('Billing', () => {
      expect(currentOwner()).toBe('Billing');
    });
  });

  it('propagates through promises and timers', async () => {
    await runWithOwner('Identity', async () => {
      await Promise.resolve();
      expect(currentOwner()).toBe('Identity');

      await new Promise((resolve) => setTimeout(resolve, 1));
      expect(currentOwner()).toBe('Identity');
    });
  });

  it('nested scopes override the outer scope', () => {
    runWithOwner('Billing', () => {
      runWithOwner('Platform', () => {
        expect(currentOwner()).toBe('Platform');
      });
      expect(currentOwner()).toBe('Billing');
    });
  });

  it('returns the callback result', () => {
    const result = runWithOwner('Billing', () => 42);
    expect(result).toBe(42);
  });
});
