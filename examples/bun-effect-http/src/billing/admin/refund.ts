import { runWithOwner } from '@strays/runtime/runWithOwner';

export function adminRefund(amount: number): number {
  return runWithOwner('Platform', () => amount);
}
