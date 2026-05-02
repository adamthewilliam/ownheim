import { withOwnerScope } from '@strays/runtime/withOwnerScope';

export const owned = withOwnerScope<
  [unknown, unknown, (err?: unknown) => void],
  void
>((_req, _res, next) => () => next());

export type OwnerMiddleware = ReturnType<typeof owned>;
