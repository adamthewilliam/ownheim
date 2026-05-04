import { runWithOwner } from '@strays/runtime/scope/runWithOwner';

export function adminRefund(amount: number): number {
  return runWithOwner('Platform', () => amount);
}
