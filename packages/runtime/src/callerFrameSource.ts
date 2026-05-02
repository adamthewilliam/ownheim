import type { FrameSource } from './FrameSource.ts';

export function callerFrameSource(skipFrames = 2): FrameSource {
  return {
    *frames() {
      const stack = captureStack();
      if (!stack) return;

      for (let i = skipFrames; i < stack.length; i++) {
        const frame = stack[i];
        if (!frame) continue;

        const file = parseFrameFile(frame);
        if (!file) continue;

        yield file;
      }
    },
  };
}

function captureStack(): string[] | undefined {
  const err = new Error();
  Error.captureStackTrace(err, captureStack);
  if (typeof err.stack !== 'string') return undefined;
  return err.stack.split('\n').slice(1);
}

function parseFrameFile(frame: string): string | undefined {
  const parenMatch = frame.match(/\((.+):\d+:\d+\)\s*$/);
  if (parenMatch?.[1]) return parenMatch[1];

  const bareMatch = frame.match(/at\s+(\S+):\d+:\d+\s*$/);
  if (bareMatch?.[1]) return bareMatch[1];

  return undefined;
}
