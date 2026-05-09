import type { ManifestRegistry } from '../manifest/ManifestRegistry.ts';

/**
 * Yields candidate source-file paths in the order the consumer should
 * consult them. Vendor / internal frames are *not* filtered here — that
 * policy lives in `findOwnedFrame`, because each source has its own idea
 * of "in-app" (Sentry already encodes it as `in_app: false`, V8 does not).
 */
export interface FrameSource {
  frames(): Iterable<string>;
}

export interface SentryFrame {
  readonly filename?: string;
  readonly in_app?: boolean;
}

export interface SentryStacktrace {
  readonly frames?: readonly SentryFrame[];
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

function captureStack(): string[] | undefined {
  const err = new Error();
  Error.captureStackTrace(err, captureStack);
  if (typeof err.stack !== 'string') return undefined;
  return err.stack.split('\n').slice(1);
}

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

export function fromSentryFrames(s: SentryStacktrace | undefined): FrameSource {
  return {
    *frames() {
      const frames = s?.frames;
      if (!frames) return;

      // Sentry payload: deepest (most-recent) frame is last.
      // Iterate newest-last so the deepest in_app frame is consulted first.
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
