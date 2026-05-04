import { afterEach, describe, expect, it } from 'bun:test';
import { OwnedError } from '@strays/core/OwnedError';
import { fromSentryFrames } from './fromSentryFrames.ts';
import { clearManifest, loadManifest } from './manifest.ts';
import { resolveOwnerWithSource } from './resolveOwnerWithSource.ts';
import { runWithOwner } from './runWithOwner.ts';

describe('resolveOwnerWithSource', () => {
  afterEach(() => {
    clearManifest();
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
