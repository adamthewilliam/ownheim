import { describe, expect, it } from 'bun:test';
import { OwnedError } from '../src/OwnedError.ts';
import { ManifestRegistry } from '../src/manifest/ManifestRegistry.ts';
import {
  currentEntrypointOwner,
  resolveOwnership,
  runWithEntrypointOwner,
  withEntrypointOwnerScope,
} from '../src/ownership.ts';
import type { FrameSource } from '../src/resolution/frames.ts';

describe('runWithEntrypointOwner / currentEntrypointOwner', () => {
  it('returns undefined outside any scope', () => {
    expect(currentEntrypointOwner()).toBeUndefined();
  });

  it('exposes the entrypoint owner inside the callback', () => {
    runWithEntrypointOwner('Billing', () => {
      expect(currentEntrypointOwner()).toBe('Billing');
    });
    expect(currentEntrypointOwner()).toBeUndefined();
  });

  it('propagates through promises and timers', async () => {
    await runWithEntrypointOwner('Identity', async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      expect(currentEntrypointOwner()).toBe('Identity');
    });
  });

  it('nested scopes override the outer scope and unwind correctly', () => {
    runWithEntrypointOwner('Billing', () => {
      runWithEntrypointOwner('Platform', () => {
        expect(currentEntrypointOwner()).toBe('Platform');
      });
      expect(currentEntrypointOwner()).toBe('Billing');
    });
  });
});

describe('withEntrypointOwnerScope', () => {
  it('runs the continuation inside an entrypoint owner scope', () => {
    const factory = withEntrypointOwnerScope<[() => unknown], unknown>((next) => next);
    let observed: string | undefined;

    factory('Billing')(() => {
      observed = currentEntrypointOwner();
    });

    expect(observed).toBe('Billing');
  });

  it('preserves the scope across await boundaries inside the continuation', async () => {
    const factory = withEntrypointOwnerScope<[() => Promise<unknown>], Promise<unknown>>(
      (next) => next,
    );
    const samples: Array<string | undefined> = [];

    await factory('Identity')(async () => {
      samples.push(currentEntrypointOwner());
      await new Promise((resolve) => setTimeout(resolve, 1));
      samples.push(currentEntrypointOwner());
    });

    expect(samples).toEqual(['Identity', 'Identity']);
    expect(currentEntrypointOwner()).toBeUndefined();
  });
});

describe('resolveOwnership', () => {
  it('returns independent entrypoint, code, and responder ownership layers', () => {
    const err = new OwnedError('boom', { responderTeam: 'Billing' });

    const result = runWithEntrypointOwner('Accounts', () =>
      resolveOwnership({ error: err, moduleOwner: 'Ledger' }),
    );

    expect(result).toEqual({
      ownership: {
        entrypointTeam: 'Accounts',
        codeTeam: 'Ledger',
        responderTeam: 'Billing',
      },
      sources: {
        entrypointTeam: 'scope',
        codeTeam: 'module',
        responderTeam: 'error',
      },
    });
  });

  it('uses stack frames for code ownership when no module owner is supplied', () => {
    const registry = ManifestRegistry.fromManifest({
      version: 1,
      files: { '/repo/packages/billing/src/ledger.ts': 'Billing' },
    });

    const frameSource: FrameSource = {
      *frames() {
        yield '/repo/node_modules/vendor.js';
        yield '/repo/packages/billing/src/ledger.ts';
      },
    };

    const result = resolveOwnership({ registry, frameSource });

    expect(result.ownership.codeTeam).toBe('Billing');
    expect(result.sources.codeTeam).toBe('frame');
  });

  it('falls back code ownership when no code owner resolves', () => {
    expect(resolveOwnership({ fallbackCodeTeam: 'platform-default' })).toEqual({
      ownership: { codeTeam: 'platform-default' },
      sources: { codeTeam: 'fallback' },
    });
  });

  it('does not let entrypoint ownership mask code ownership', () => {
    const result = runWithEntrypointOwner('Accounts', () =>
      resolveOwnership({ moduleOwner: 'Billing' }),
    );

    expect(result.ownership).toEqual({
      entrypointTeam: 'Accounts',
      codeTeam: 'Billing',
    });
  });
});
