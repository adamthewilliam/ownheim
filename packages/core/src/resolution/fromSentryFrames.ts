import type { FrameSource } from './callerFrameSource.ts';

export interface SentryFrame {
  readonly filename?: string;
  readonly in_app?: boolean;
}

export interface SentryStacktrace {
  readonly frames?: readonly SentryFrame[];
}

export function fromSentryFrames(s: SentryStacktrace | undefined): FrameSource {
  return {
    *frames() {
      const frames = s?.frames;
      if (!frames) return;

      // Sentry payload: deepest (most-recent) frame is last.
      // Iterate newest-last (i.e. reverse) so the deepest in_app frame is
      // consulted first.
      for (let i = frames.length - 1; i >= 0; i--) {
        const frame = frames[i];
        if (!frame) continue;
        if (frame.in_app === false) continue;
        const file = frame.filename;
        if (!file) continue;
        yield file;
      }
    },
  };
}
