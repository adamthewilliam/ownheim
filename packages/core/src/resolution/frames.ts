import type { ManifestRegistry } from '../manifest/ManifestRegistry.ts';

/**
 * Yields candidate source-file paths in the order the consumer should
 * consult them. Vendor / internal frames are *not* filtered here — that
 * policy lives in `findOwnedFrame`, so callers can pass raw source paths.
 */
export interface FrameSource {
  frames(): Iterable<string>;
}

const VENDOR_PATTERNS: readonly RegExp[] = [
  /\/node_modules\//,
  /^node:/,
  /\(node:internal\//,
  /\(internal\//,
];

export function isVendorFrame(file: string): boolean {
  return VENDOR_PATTERNS.some((p) => p.test(file));
}

const PAREN_FRAME = /\((.+):\d+:\d+\)\s*$/;
const BARE_FRAME = /at\s+(\S+):\d+:\d+\s*$/;

export function parseFrameFile(frame: string): string | undefined {
  const parenMatch = frame.match(PAREN_FRAME);
  if (parenMatch?.[1]) return parenMatch[1];

  const bareMatch = frame.match(BARE_FRAME);
  if (bareMatch?.[1]) return bareMatch[1];

  return undefined;
}

export function captureStackLines(trimBoundary: (...args: never[]) => unknown): string[] | undefined {
  const err = new Error();
  Error.captureStackTrace(err, trimBoundary);
  if (typeof err.stack !== 'string') return undefined;
  return err.stack.split('\n').slice(1);
}

export function callerFrameSource(skipFrames = 2): FrameSource {
  return {
    *frames() {
      const stack = captureStackLines(captureStackLines);
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

/**
 * Walk a frame source, skipping vendor frames, and return the first owner
 * the registry knows about. The single shared implementation behind both
 * `lookupCallerOwner` and the frame tier of `resolveOwner`.
 */
export function findOwnedFrame(
  source: FrameSource,
  registry: ManifestRegistry,
): string | undefined {
  for (const file of source.frames()) {
    if (isVendorFrame(file)) continue;
    const owner = registry.lookupOwner(file);
    if (owner !== undefined) return owner;
  }
  return undefined;
}
