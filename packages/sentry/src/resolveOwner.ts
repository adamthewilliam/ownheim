import { currentOwner } from '@strays/runtime/currentOwner';
import { lookupOwner } from '@strays/runtime/manifest';
import { walkOwnedErrorChain } from '@strays/runtime/walkOwnedErrorChain';

export interface SentryFrame {
  readonly filename?: string;
  readonly in_app?: boolean;
}

export interface SentryStacktrace {
  readonly frames?: readonly SentryFrame[];
}

const VENDOR_PATTERNS = [/\/node_modules\//, /^node:/, /\(internal\//];

export function resolveOwnerFromEvent(
  exception: unknown,
  stacktrace: SentryStacktrace | undefined,
  fallback = 'unowned',
): string {
  return (
    walkOwnedErrorChain(exception) ??
    currentOwner() ??
    resolveFromStackFrames(stacktrace) ??
    fallback
  );
}

function resolveFromStackFrames(stacktrace: SentryStacktrace | undefined): string | undefined {
  if (!stacktrace?.frames) return undefined;
  for (let i = stacktrace.frames.length - 1; i >= 0; i--) {
    const frame = stacktrace.frames[i];
    const file = frame?.filename;
    if (!file) continue;
    if (frame?.in_app === false) continue;
    if (VENDOR_PATTERNS.some((p) => p.test(file))) continue;
    const owner = lookupOwner(file);
    if (owner !== undefined) return owner;
  }
  return undefined;
}
