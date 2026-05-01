import { ownerStore } from './store.ts';

export function runWithOwner<TResult>(owner: string, fn: () => TResult): TResult {
  return ownerStore.run(owner, fn);
}
