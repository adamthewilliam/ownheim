import { OWNER_TAG } from './symbols.ts';

export class OwnedError extends Error {
  readonly [OWNER_TAG]: string;
  override readonly name: string = 'OwnedError';

  constructor(message: string, owner: string, options?: ErrorOptions) {
    super(message, options);
    this[OWNER_TAG] = owner;
  }
}

export function isOwnedError(value: unknown): value is OwnedError {
  return (
    typeof value === 'object' &&
    value !== null &&
    OWNER_TAG in value &&
    typeof (value as { [OWNER_TAG]: unknown })[OWNER_TAG] === 'string'
  );
}

export function getErrorOwner(value: unknown): string | undefined {
  if (!isOwnedError(value)) return undefined;
  return value[OWNER_TAG];
}
