// Back-compat tests: verifies the deprecated free-function shim still routes
// through the default ManifestRegistry singleton. New code should use
// `ManifestRegistry` and `getDefaultRegistry()` directly.
import { afterEach, describe, expect, it } from 'bun:test';
import { clearManifest, loadManifest, lookupOwner } from './manifest.ts';

describe('manifest (compat shim)', () => {
  afterEach(() => {
    clearManifest();
  });

  it('returns undefined when no manifest is loaded', () => {
    expect(lookupOwner('/any/path.ts')).toBeUndefined();
  });

  it('looks up an exact file path', () => {
    loadManifest({
      version: 1,
      files: { 'src/billing/charge.ts': 'Billing' },
    });

    expect(lookupOwner('src/billing/charge.ts')).toBe('Billing');
  });

  it('returns undefined for unknown files', () => {
    loadManifest({ version: 1, files: { 'src/billing/charge.ts': 'Billing' } });
    expect(lookupOwner('src/unknown.ts')).toBeUndefined();
  });

  it('normalises file:// URLs and Windows separators', () => {
    loadManifest({
      version: 1,
      files: { 'src/billing/charge.ts': 'Billing' },
    });

    expect(lookupOwner('file:///abs/src/billing/charge.ts')).toBeUndefined();
    expect(lookupOwner('src\\billing\\charge.ts')).toBe('Billing');
  });

  it('caches lookups (negative results too)', () => {
    loadManifest({ version: 1, files: { 'a.ts': 'Billing' } });
    expect(lookupOwner('a.ts')).toBe('Billing');
    expect(lookupOwner('a.ts')).toBe('Billing');
    expect(lookupOwner('missing.ts')).toBeUndefined();
    expect(lookupOwner('missing.ts')).toBeUndefined();
  });

  it('clearManifest invalidates lookups', () => {
    loadManifest({ version: 1, files: { 'a.ts': 'Billing' } });
    expect(lookupOwner('a.ts')).toBe('Billing');
    clearManifest();
    expect(lookupOwner('a.ts')).toBeUndefined();
  });
});
