import { OWNER_TAG } from '../symbols.ts';

interface OwnedShape {
  readonly [OWNER_TAG]?: unknown;
  readonly cause?: unknown;
}

export function isOwnedShape(value: unknown): value is OwnedShape {
  return value !== null && value !== undefined && typeof value === 'object';
}

export function walkResponderTeamChain(value: unknown): string | undefined {
  let current: unknown = value;
  const seen = new WeakSet<object>();

  while (isOwnedShape(current)) {
    if (seen.has(current as object)) return undefined;
    seen.add(current as object);

    const owner = current[OWNER_TAG];
    if (typeof owner === 'string') return owner;

    current = current.cause;
  }

  return undefined;
}

export const walkOwnedErrorChain = walkResponderTeamChain;
