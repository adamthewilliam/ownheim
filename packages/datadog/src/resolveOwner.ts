import { currentOwner } from '@strays/runtime/currentOwner';
import { lookupCallerOwner } from '@strays/runtime/lookupCallerOwner';
import { walkOwnedErrorChain } from '@strays/runtime/walkOwnedErrorChain';

export function resolveOwner(error?: unknown, fallback = 'unowned'): string {
  return walkOwnedErrorChain(error) ?? currentOwner() ?? lookupCallerOwner(2) ?? fallback;
}
