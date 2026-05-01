import { ownerStore } from './store.ts';

export function currentOwner(): string | undefined {
  return ownerStore.getStore();
}
