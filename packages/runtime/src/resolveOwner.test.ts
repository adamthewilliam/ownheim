import { afterEach, describe, expect, it } from 'bun:test';
import { OwnedError } from '@strays/core/OwnedError';
import { clearManifest, loadManifest } from './manifest.ts';
import { fromSentryFrames } from './fromSentryFrames.ts';
import { resolveOwner } from './resolveOwner.ts';
import { runWithOwner } from './runWithOwner.ts';

describe('resolveOwner', () => {
  afterEach(() => {
    clearManifest();
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
