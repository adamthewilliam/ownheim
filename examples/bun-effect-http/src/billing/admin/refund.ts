import { runWithOwner } from '@ownheim/core/ownership';

export function adminRefund(amount: number): number {
  return runWithOwner('Platform', () => amount);
}
