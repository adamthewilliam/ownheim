import { currentOwner } from '@strays/runtime/currentOwner';
import { lookupCallerOwner } from '@strays/runtime/lookupCallerOwner';

export function resolveOwner(fallback = 'unowned'): string {
  return currentOwner() ?? lookupCallerOwner(2) ?? fallback;
}
