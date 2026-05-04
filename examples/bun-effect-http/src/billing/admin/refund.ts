import { runWithOwner } from '@strays/core/scope/runWithOwner';

export function adminRefund(amount: number): number {
  return runWithOwner('Platform', () => amount);
}
