import { withTeamScope } from '@strays/runtime/withTeamScope';

export const teamMiddleware = withTeamScope<
  [unknown, () => Promise<void>],
  Promise<void>
>((_c, next) => next);

export type TeamMiddleware = ReturnType<typeof teamMiddleware>;
