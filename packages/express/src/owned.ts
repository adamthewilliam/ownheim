import { withTeamScope } from '@strays/runtime/withTeamScope';

export const owned = withTeamScope<
  [unknown, unknown, (err?: unknown) => void],
  void
>((_req, _res, next) => () => next());

export type TeamMiddleware = ReturnType<typeof owned>;
