import { OwnedError } from '@ownheim/core';

export async function getUser(id: string) {
  if (!id.startsWith('user_')) {
    throw new OwnedError('invalid user id', { responderTeam: 'Identity' });
  }

  return { id, email: 'ada@example.com' };
}
