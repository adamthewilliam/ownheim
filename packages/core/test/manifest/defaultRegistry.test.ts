import { afterEach, describe, expect, it } from 'bun:test';
import { ManifestRegistry } from '../../src/manifest/ManifestRegistry.ts';
import {
  getDefaultRegistry,
  registerOwnershipManifest,
  resetDefaultRegistry,
  setDefaultRegistry,
} from '../../src/manifest/defaultRegistry.ts';

describe('defaultRegistry', () => {
  afterEach(() => {
    resetDefaultRegistry();
  });

  it('starts with a stable empty registry that misses all lookups', () => {
    const registry = getDefaultRegistry();
    expect(registry.lookupOwner('anything.ts')).toBeUndefined();
  });

  it('returns the same instance across calls until swapped', () => {
    const a = getDefaultRegistry();
    const b = getDefaultRegistry();
    expect(a).toBe(b);
  });

  it('swaps atomically via setDefaultRegistry', () => {
    const before = getDefaultRegistry();
    const next = ManifestRegistry.fromManifest({
      version: 1,
      files: { 'src/billing.ts': 'Billing' },
    });

    setDefaultRegistry(next);
    const after = getDefaultRegistry();

    expect(after).toBe(next);
    expect(after).not.toBe(before);
    expect(after.lookupOwner('src/billing.ts')).toBe('Billing');
  });

  it('registers a manifest and returns the registered registry', () => {
    const registry = registerOwnershipManifest({
      version: 1,
      files: { 'src/billing.ts': 'Billing' },
    });

    expect(getDefaultRegistry()).toBe(registry);
    expect(registry.lookupOwner('src/billing.ts')).toBe('Billing');
  });

  it('resetDefaultRegistry restores an empty default', () => {
    setDefaultRegistry(
      ManifestRegistry.fromManifest({
        version: 1,
        files: { 'a.ts': 'Identity' },
      }),
    );
    expect(getDefaultRegistry().lookupOwner('a.ts')).toBe('Identity');

    resetDefaultRegistry();
    expect(getDefaultRegistry().lookupOwner('a.ts')).toBeUndefined();
  });
});
