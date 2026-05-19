import { withEntrypointOwnerScope } from '@ownheim/core/ownership';

export const entrypointOwner = withEntrypointOwnerScope<
  [{ next: () => Promise<unknown> }],
  Promise<unknown>
>(({ next }) => next);

export type EntrypointOwnerMiddleware = ReturnType<typeof entrypointOwner>;
