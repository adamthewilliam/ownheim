import { OWNER_TAG } from '@strays/core/symbols';

export function walkOwnedErrorChain(value: unknown): string | undefined {
  let current: unknown = value;
  const seen = new WeakSet<object>();

  while (current !== null && current !== undefined && typeof current === 'object') {
    if (seen.has(current)) return undefined;
    seen.add(current);

    const tagged = current as { [OWNER_TAG]?: unknown; cause?: unknown };
    const owner = tagged[OWNER_TAG];
    if (typeof owner === 'string') return owner;

    current = tagged.cause;
  }

  return undefined;
}
