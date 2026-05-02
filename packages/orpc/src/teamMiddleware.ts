import { withTeamScope } from '@strays/runtime/withTeamScope';

export const teamMiddleware = withTeamScope<
  [{ next: () => Promise<unknown> }],
  Promise<unknown>
>(({ next }) => next);

export type TeamMiddleware = ReturnType<typeof teamMiddleware>;
