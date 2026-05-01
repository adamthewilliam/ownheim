export const OWNER_TAG: unique symbol = Symbol.for('@strays/owner') as never;

export type OwnerTag = typeof OWNER_TAG;
