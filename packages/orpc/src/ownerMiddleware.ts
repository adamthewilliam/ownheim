import { withOwnerScope } from '@strays/core/ownership';

export const ownerMiddleware = withOwnerScope<
  [{ next: () => Promise<unknown> }],
  Promise<unknown>
>(({ next }) => next);

export type OwnerMiddleware = ReturnType<typeof ownerMiddleware>;
