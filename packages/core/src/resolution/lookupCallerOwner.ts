import type { ManifestRegistry } from '../manifest/ManifestRegistry.ts';
import { getDefaultRegistry } from '../manifest/defaultRegistry.ts';
import { captureStackLines, findOwnedFrame, parseFrameFile, type FrameSource } from './frames.ts';

export function lookupCallerOwner(
  skipFrames = 1,
  registry: ManifestRegistry = getDefaultRegistry(),
): string | undefined {
  // Capture here (not in `callerFrameSource`) so the documented
  // `skipFrames` semantics — "1 = land on the caller of lookupCallerOwner"
  // — survive.
  const stack = captureStackLines(captureStackLines);
  if (!stack) return undefined;

  const source: FrameSource = {
    *frames() {
      for (let i = skipFrames; i < stack.length; i++) {
        const frame = stack[i];
        if (!frame) continue;
        const file = parseFrameFile(frame);
        if (file) yield file;
      }
    },
  };
  return findOwnedFrame(source, registry);
}
