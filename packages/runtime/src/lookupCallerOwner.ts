import { lookupOwner } from './manifest.ts';

const VENDOR_PATTERNS = [
  /\/node_modules\//,
  /^node:/,
  /\(node:internal\//,
  /\(internal\//,
];

const cache = new Map<string, string | undefined>();

export function lookupCallerOwner(skipFrames = 1): string | undefined {
  const stack = captureStack();
  if (!stack) return undefined;

  for (let i = skipFrames; i < stack.length; i++) {
    const frame = stack[i];
    if (!frame) continue;

    const file = parseFrameFile(frame);
    if (!file || isVendor(file)) continue;

    if (cache.has(file)) return cache.get(file);
    const owner = lookupOwner(file);
    cache.set(file, owner);
    if (owner !== undefined) return owner;
  }

  return undefined;
}

export function clearCallerCache(): void {
  cache.clear();
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

function isVendor(file: string): boolean {
  return VENDOR_PATTERNS.some((p) => p.test(file));
}
