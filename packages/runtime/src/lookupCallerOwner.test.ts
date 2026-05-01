import { afterEach, describe, expect, it } from 'bun:test';
import { clearManifest, loadManifest } from './manifest.ts';
import { clearCallerCache, lookupCallerOwner } from './lookupCallerOwner.ts';

describe('lookupCallerOwner', () => {
  afterEach(() => {
    clearManifest();
    clearCallerCache();
  });

  it('returns undefined when no manifest is loaded', () => {
    expect(lookupCallerOwner()).toBeUndefined();
  });

  it('resolves the calling file via the manifest', () => {
    const callerFile = import.meta.path;
    loadManifest({ version: 1, files: { [callerFile]: 'Billing' } });

    expect(lookupCallerOwner()).toBe('Billing');
  });

  it('caches lookups to avoid repeated stack walks', () => {
    const callerFile = import.meta.path;
    loadManifest({ version: 1, files: { [callerFile]: 'Identity' } });

    expect(lookupCallerOwner()).toBe('Identity');
    expect(lookupCallerOwner()).toBe('Identity');
  });

  it('returns undefined when only vendor frames are present', () => {
    loadManifest({ version: 1, files: {} });
    expect(lookupCallerOwner()).toBeUndefined();
  });
});
