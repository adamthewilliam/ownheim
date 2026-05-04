import { afterEach, describe, expect, it } from 'bun:test';
import { OwnedError } from '../OwnedError.ts';
import { ManifestRegistry, type OwnershipManifest } from '../manifest/ManifestRegistry.ts';
import { resetDefaultRegistry, setDefaultRegistry } from '../manifest/defaultRegistry.ts';
import { fromSentryFrames } from './fromSentryFrames.ts';
import { resolveOwner, resolveOwnerWithSource } from './resolveOwner.ts';
import { runWithOwner } from '../scope/runWithOwner.ts';

function loadManifest(manifest: OwnershipManifest): void {
  setDefaultRegistry(ManifestRegistry.fromManifest(manifest));
}

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
    // With scope set, scope wins.
    const fromScope = runWithOwner('Platform', () =>
      resolveOwner({ moduleOwner: 'Module', fallback: 'unowned' }),
    );
    expect(fromScope).toBe('Platform');

    // Without scope and without a manifest match, moduleOwner wins.
    const fromModule = resolveOwner({ moduleOwner: 'Module', fallback: 'unowned' });
    expect(fromModule).toBe('Module');

    // Without scope, no moduleOwner, but a manifest entry for the caller, frame wins.
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
        // Sentry payload: deepest frame is last; iterate newest-last.
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
