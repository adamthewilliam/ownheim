import { withEntrypointOwnerScope } from '@ownheim/core/ownership';

export const entrypointOwner = withEntrypointOwnerScope<
  [unknown, () => Promise<void>],
  Promise<void>
>((_c, next) => next);

export type EntrypointOwnerMiddleware = ReturnType<typeof entrypointOwner>;
