import { withEntrypointOwnerScope } from '@ownheim/core/ownership';

export const entrypointOwner = withEntrypointOwnerScope<
  [unknown, unknown, (err?: unknown) => void],
  void
>((_req, _res, next) => () => next());

export type EntrypointOwnerMiddleware = ReturnType<typeof entrypointOwner>;
