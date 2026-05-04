import { describe, expect, it } from 'bun:test';
import { ManifestRegistry } from '../manifest/ManifestRegistry.ts';
import { lookupCallerOwner } from './lookupCallerOwner.ts';

describe('lookupCallerOwner', () => {
  it('returns undefined when the registry is empty', () => {
    expect(lookupCallerOwner(1, ManifestRegistry.empty())).toBeUndefined();
  });

  it('resolves the calling file via the supplied registry', () => {
    const callerFile = import.meta.path;
    const registry = ManifestRegistry.fromManifest({
      version: 1,
      files: { [callerFile]: 'Billing' },
    });

    expect(lookupCallerOwner(1, registry)).toBe('Billing');
  });

  it('two registries on the same caller path produce different answers without any cleanup', () => {
    const callerFile = import.meta.path;
    const billing = ManifestRegistry.fromManifest({
      version: 1,
      files: { [callerFile]: 'Billing' },
    });
    const identity = ManifestRegistry.fromManifest({
      version: 1,
      files: { [callerFile]: 'Identity' },
    });

    expect(lookupCallerOwner(1, billing)).toBe('Billing');
    expect(lookupCallerOwner(1, identity)).toBe('Identity');
  });

  it('caches lookups inside the registry so repeat calls are stable', () => {
    const callerFile = import.meta.path;
    const registry = ManifestRegistry.fromManifest({
      version: 1,
      files: { [callerFile]: 'Identity' },
    });

    expect(lookupCallerOwner(1, registry)).toBe('Identity');
    expect(lookupCallerOwner(1, registry)).toBe('Identity');
  });

  it('returns undefined when only vendor frames are present', () => {
    const registry = ManifestRegistry.fromManifest({ version: 1, files: {} });
    expect(lookupCallerOwner(1, registry)).toBeUndefined();
  });
});
