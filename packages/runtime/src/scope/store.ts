import { AsyncLocalStorage } from 'node:async_hooks';

export const ownerStore = new AsyncLocalStorage<string>();
