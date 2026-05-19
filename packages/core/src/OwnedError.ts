import { OWNER_TAG } from './symbols.ts';

export interface OwnedErrorOptions extends ErrorOptions {
  readonly responderTeam: string;
}

export class OwnedError extends Error {
  readonly [OWNER_TAG]: string;
  readonly responderTeam: string;
  override readonly name: string = 'OwnedError';

  constructor(message: string, options: OwnedErrorOptions) {
    super(message, options);
    this[OWNER_TAG] = options.responderTeam;
    this.responderTeam = options.responderTeam;
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

export function getResponderTeam(value: unknown): string | undefined {
  if (!isOwnedError(value)) return undefined;
  return value[OWNER_TAG];
}

export function withResponderTeam<TError extends Error>(error: TError, responderTeam: string): TError {
  Object.defineProperty(error, OWNER_TAG, {
    value: responderTeam,
    enumerable: false,
    configurable: false,
  });
  return error;
}
