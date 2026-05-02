import { withOwnerScope } from '@strays/runtime/withOwnerScope';

export const ownerMiddleware = withOwnerScope<
  [unknown, () => Promise<void>],
  Promise<void>
>((_c, next) => next);

export type OwnerMiddleware = ReturnType<typeof ownerMiddleware>;
