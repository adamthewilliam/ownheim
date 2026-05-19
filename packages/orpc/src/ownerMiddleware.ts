import { promiseNextEntrypointOwner } from '@ownheim/core/ownership';

export const entrypointOwner = promiseNextEntrypointOwner;

export type EntrypointOwnerMiddleware = ReturnType<typeof entrypointOwner>;
