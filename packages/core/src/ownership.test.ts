import { afterEach, describe, expect, it } from 'bun:test';
import { OwnedError } from './OwnedError.ts';
import { ManifestRegistry, type OwnershipManifest } from './manifest/ManifestRegistry.ts';
import { resetDefaultRegistry, setDefaultRegistry } from './manifest/defaultRegistry.ts';
import { fromSentryFrames } from './resolution/frames.ts';
import {
  currentOwner,
  resolveOwner,
  resolveOwnerWithSource,
  runWithOwner,
  withOwnerScope,
} from './ownership.ts';

function loadManifest(manifest: OwnershipManifest): void {
  setDefaultRegistry(ManifestRegistry.fromManifest(manifest));
}

// ---------------------------------------------------------------------------
// Scope: runWithOwner / currentOwner
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Scope: withOwnerScope (framework middleware factory)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Resolution: resolveOwner / resolveOwnerWithSource
// ---------------------------------------------------------------------------

describe('resolveOwner', () => {
  afterEach(() => {
    resetDefaultRegistry();
  });

  it('chain order, happy path: OwnedError wins over scope and frames', () => {
    const callerFile = import.meta.path;
    loadManifest({ version: 1, files: { [callerFile]: 'Frames' } });
    const err = new OwnedError('boom', 'Identity');

    const team = runWithOwner('Platform', () =>
      resolveOwner({ error: err, moduleOwner: 'Module', fallback: 'unowned' }),
    );

    expect(team).toBe('Identity');
  });

  it('scope beats module owner beats frames', () => {
    const fromScope = runWithOwner('Platform', () =>
      resolveOwner({ moduleOwner: 'Module', fallback: 'unowned' }),
    );
    expect(fromScope).toBe('Platform');

    const fromModule = resolveOwner({ moduleOwner: 'Module', fallback: 'unowned' });
    expect(fromModule).toBe('Module');

    const callerFile = import.meta.path;
    loadManifest({ version: 1, files: { [callerFile]: 'Frames' } });
    const fromFrames = resolveOwner({ fallback: 'unowned' });
    expect(fromFrames).toBe('Frames');
  });

  it('Sentry FrameSource integration: skips vendor and in_app=false, lands on registered frame', () => {
    loadManifest({
      version: 1,
      files: { 'src/billing/charge.ts': 'Billing' },
    });

    const stacktrace = {
      frames: [
        { filename: 'src/billing/charge.ts' },
        { filename: '/path/to/node_modules/lodash/index.js' },
        { filename: 'src/internal/helper.ts', in_app: false },
      ],
    };

    const team = resolveOwner({
      frameSource: fromSentryFrames(stacktrace),
      fallback: 'unowned',
    });

    expect(team).toBe('Billing');
  });

  it('falls back to "unowned" when nothing matches; honours explicit fallback', () => {
    expect(resolveOwner()).toBe('unowned');
    expect(resolveOwner({ fallback: 'platform-default' })).toBe('platform-default');
  });

  it('cyclic error chain does not hang and falls through to next tier', () => {
    const a = new Error('a') as Error & { cause?: unknown };
    const b = new Error('b', { cause: a }) as Error & { cause?: unknown };
    a.cause = b;

    const team = resolveOwner({ error: a, moduleOwner: 'Module', fallback: 'unowned' });
    expect(team).toBe('Module');
  });
});

describe('resolveOwnerWithSource', () => {
  afterEach(() => {
    resetDefaultRegistry();
  });

  it('source: "error" when an OwnedError is supplied', () => {
    const err = new OwnedError('boom', 'Billing');
    expect(resolveOwnerWithSource({ error: err, fallback: 'unowned' })).toEqual({
      owner: 'Billing',
      source: 'error',
    });
  });

  it('source: "scope" when ALS is active and no error owner is present', () => {
    const result = runWithOwner('Platform', () =>
      resolveOwnerWithSource({ fallback: 'unowned' }),
    );
    expect(result).toEqual({ owner: 'Platform', source: 'scope' });
  });

  it('source: "frame" when manifest matches a stack file', () => {
    const callerFile = import.meta.path;
    loadManifest({ version: 1, files: { [callerFile]: 'Frames' } });
    expect(resolveOwnerWithSource({ fallback: 'unowned' })).toEqual({
      owner: 'Frames',
      source: 'frame',
    });
  });

  it('source: "frame" with a custom Sentry-shaped frame source', () => {
    loadManifest({
      version: 1,
      files: { 'src/billing/charge.ts': 'Billing' },
    });
    const stacktrace = {
      frames: [
        { filename: 'src/billing/charge.ts' },
        { filename: '/path/to/node_modules/lodash/index.js' },
      ],
    };
    expect(
      resolveOwnerWithSource({
        frameSource: fromSentryFrames(stacktrace),
        fallback: 'unowned',
      }),
    ).toEqual({ owner: 'Billing', source: 'frame' });
  });

  it('source: "module" when only moduleOwner is supplied', () => {
    expect(
      resolveOwnerWithSource({ moduleOwner: 'ModuleTeam', fallback: 'unowned' }),
    ).toEqual({ owner: 'ModuleTeam', source: 'module' });
  });

  it('source: "fallback" when nothing else matches', () => {
    expect(resolveOwnerWithSource({ fallback: 'platform-default' })).toEqual({
      owner: 'platform-default',
      source: 'fallback',
    });
  });

  it('default fallback owner is "unowned" with source "fallback"', () => {
    expect(resolveOwnerWithSource()).toEqual({ owner: 'unowned', source: 'fallback' });
  });

  it('error wins over scope, module, and frames', () => {
    const callerFile = import.meta.path;
    loadManifest({ version: 1, files: { [callerFile]: 'Frames' } });
    const err = new OwnedError('boom', 'Billing');
    const result = runWithOwner('Platform', () =>
      resolveOwnerWithSource({ error: err, moduleOwner: 'Module', fallback: 'unowned' }),
    );
    expect(result).toEqual({ owner: 'Billing', source: 'error' });
  });

  it('scope wins over module and frames when no error owner is present', () => {
    const callerFile = import.meta.path;
    loadManifest({ version: 1, files: { [callerFile]: 'Frames' } });
    const result = runWithOwner('Platform', () =>
      resolveOwnerWithSource({ moduleOwner: 'Module', fallback: 'unowned' }),
    );
    expect(result).toEqual({ owner: 'Platform', source: 'scope' });
  });

  it('module wins over fallback when frames yield nothing', () => {
    expect(
      resolveOwnerWithSource({ moduleOwner: 'Module', fallback: 'unowned' }),
    ).toEqual({ owner: 'Module', source: 'module' });
  });
});
