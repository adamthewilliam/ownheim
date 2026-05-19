import { OwnedError } from '@ownheim/core';

export function requireUser(authorization: string | undefined) {
  if (!authorization) {
    throw new OwnedError('missing authorization header', { responderTeam: 'Identity' });
  }

  return { id: 'user_123' };
}
