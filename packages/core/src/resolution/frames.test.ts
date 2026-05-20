import { describe, expect, it } from 'bun:test';
import { ManifestRegistry } from '../manifest/ManifestRegistry.ts';
import {
  callerFrameSource,
  findOwnedFrame,
  isVendorFrame,
  parseFrameFile,
  type FrameSource,
} from './frames.ts';

describe('parseFrameFile', () => {
  it('extracts a path from a parenthesised V8 frame', () => {
    expect(parseFrameFile('    at Foo.bar (/abs/path/file.ts:12:34)')).toBe('/abs/path/file.ts');
  });

  it('extracts a path from a bare V8 frame', () => {
    expect(parseFrameFile('    at /abs/path/file.ts:12:34')).toBe('/abs/path/file.ts');
  });

  it('returns undefined for a frame with no path', () => {
    expect(parseFrameFile('    at <anonymous>')).toBeUndefined();
  });
});

describe('isVendorFrame', () => {
  it('flags node_modules paths', () => {
    expect(isVendorFrame('/repo/node_modules/lodash/index.js')).toBe(true);
  });

  it('flags node:* builtins and internals', () => {
    expect(isVendorFrame('node:fs')).toBe(true);
    expect(isVendorFrame('    at f (node:internal/timers:1:1)')).toBe(true);
    expect(isVendorFrame('    at f (internal/process/task_queues:1:1)')).toBe(true);
  });

  it('does not flag in-app source paths', () => {
    expect(isVendorFrame('/repo/src/feature.ts')).toBe(false);
  });
});

describe('findOwnedFrame', () => {
  it('returns undefined when the registry is empty', () => {
    const source: FrameSource = { *frames() { yield 'src/a.ts'; yield 'src/b.ts'; } };
    expect(findOwnedFrame(source, ManifestRegistry.empty())).toBeUndefined();
  });

  it('returns the first registered file the source yields, skipping vendor frames', () => {
    const registry = ManifestRegistry.fromManifest({
      version: 1,
      files: { 'src/billing/charge.ts': 'Billing' },
    });
    const source: FrameSource = {
      *frames() {
        yield '/repo/node_modules/lodash/index.js';
        yield 'src/billing/charge.ts';
        yield 'src/identity/auth.ts';
      },
    };
    expect(findOwnedFrame(source, registry)).toBe('Billing');
  });
});

describe('callerFrameSource', () => {
  it('yields the calling file path among its frames', () => {
    const out = [...callerFrameSource(0).frames()];
    expect(out.some((p) => p.endsWith('frames.test.ts'))).toBe(true);
  });
});
