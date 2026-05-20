import { describe, expect, it } from 'bun:test';
import { ManifestRegistry } from '../../src/manifest/ManifestRegistry.ts';

describe('ManifestRegistry', () => {
  it('empty() returns a registry that always misses', () => {
    const registry = ManifestRegistry.empty();
    expect(registry.lookupOwner('any/file.ts')).toBeUndefined();
  });

  it('looks up an exact file path', () => {
    const registry = ManifestRegistry.fromManifest({
      version: 1,
      files: { 'src/billing/charge.ts': 'Billing' },
    });

    expect(registry.lookupOwner('src/billing/charge.ts')).toBe('Billing');
  });

  it('returns undefined for unknown files', () => {
    const registry = ManifestRegistry.fromManifest({
      version: 1,
      files: { 'src/billing/charge.ts': 'Billing' },
    });
    expect(registry.lookupOwner('src/unknown.ts')).toBeUndefined();
  });

  it('normalises Windows backslash separators', () => {
    const registry = ManifestRegistry.fromManifest({
      version: 1,
      files: { 'src/billing/charge.ts': 'Billing' },
    });

    expect(registry.lookupOwner('src\\billing\\charge.ts')).toBe('Billing');
  });

  it('strips file:// prefix during normalisation', () => {
    const registry = ManifestRegistry.fromManifest({
      version: 1,
      files: { '/abs/src/billing/charge.ts': 'Billing' },
    });

    expect(registry.lookupOwner('file:///abs/src/billing/charge.ts')).toBe('Billing');
  });

  it('does not match across non-matching absolute paths after normalisation', () => {
    const registry = ManifestRegistry.fromManifest({
      version: 1,
      files: { 'src/billing/charge.ts': 'Billing' },
    });

    expect(registry.lookupOwner('file:///abs/src/billing/charge.ts')).toBeUndefined();
  });

  it('caches negative lookups so repeat misses are stable', () => {
    const registry = ManifestRegistry.fromManifest({
      version: 1,
      files: { 'a.ts': 'Billing' },
    });

    expect(registry.lookupOwner('missing.ts')).toBeUndefined();
    expect(registry.lookupOwner('missing.ts')).toBeUndefined();
    expect(registry.lookupOwner('a.ts')).toBe('Billing');
    expect(registry.lookupOwner('a.ts')).toBe('Billing');
  });

  it('isolates state between independent registries', () => {
    const billing = ManifestRegistry.fromManifest({
      version: 1,
      files: { 'shared.ts': 'Billing' },
    });
    const identity = ManifestRegistry.fromManifest({
      version: 1,
      files: { 'shared.ts': 'Identity' },
    });

    expect(billing.lookupOwner('shared.ts')).toBe('Billing');
    expect(identity.lookupOwner('shared.ts')).toBe('Identity');
  });
});
