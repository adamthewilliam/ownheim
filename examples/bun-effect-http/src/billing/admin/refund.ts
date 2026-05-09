import { runWithOwner } from '@strays/core/ownership';

export function adminRefund(amount: number): number {
  return runWithOwner('Platform', () => amount);
}
