import { describe, expect, it } from 'bun:test';
import { fromSentryFrames } from './fromSentryFrames.ts';

describe('fromSentryFrames', () => {
  it('yields nothing when stacktrace is undefined', () => {
    const out = [...fromSentryFrames(undefined).frames()];
    expect(out).toEqual([]);
  });

  it('yields nothing when frames are missing', () => {
    const out = [...fromSentryFrames({}).frames()];
    expect(out).toEqual([]);
  });

  it('iterates newest-last (reverse of payload order)', () => {
    // Sentry convention: deepest frame is last in the array.
    const stacktrace = {
      frames: [
        { filename: 'a.ts' },
        { filename: 'b.ts' },
        { filename: 'c.ts' },
      ],
    };

    const out = [...fromSentryFrames(stacktrace).frames()];
    expect(out).toEqual(['c.ts', 'b.ts', 'a.ts']);
  });

  it('skips frames with no filename', () => {
    const stacktrace = {
      frames: [{ filename: 'a.ts' }, {}, { filename: 'b.ts' }],
    };

    const out = [...fromSentryFrames(stacktrace).frames()];
    expect(out).toEqual(['b.ts', 'a.ts']);
  });

  it('skips frames with in_app=false', () => {
    const stacktrace = {
      frames: [
        { filename: 'a.ts' },
        { filename: 'vendor.ts', in_app: false },
        { filename: 'b.ts', in_app: true },
      ],
    };

    const out = [...fromSentryFrames(stacktrace).frames()];
    expect(out).toEqual(['b.ts', 'a.ts']);
  });
});
