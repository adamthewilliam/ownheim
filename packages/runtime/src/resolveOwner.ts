import type { ResolveOwnerInput } from './ResolveOwnerInput.ts';
import { resolveOwnerWithSource } from './resolveOwnerWithSource.ts';

export function resolveOwner(input: ResolveOwnerInput = {}): string {
  return resolveOwnerWithSource(input).owner;
}
