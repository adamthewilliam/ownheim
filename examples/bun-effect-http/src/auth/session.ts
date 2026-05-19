import { OwnedError } from '@ownheim/core/OwnedError';

export class IdentityError extends OwnedError {
  constructor(message: string) {
    super(message, 'Identity');
  }
}

export function requireSession(token: string | undefined): string {
  if (!token) throw new IdentityError('missing session token');
  return token;
}
