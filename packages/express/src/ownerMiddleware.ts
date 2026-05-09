import { withOwnerScope } from '@strays/core/ownership';

export const ownerMiddleware = withOwnerScope<
  [unknown, unknown, (err?: unknown) => void],
  void
>((_req, _res, next) => () => next());

export type OwnerMiddleware = ReturnType<typeof ownerMiddleware>;
