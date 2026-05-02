import { runWithOwner } from '@strays/runtime/runWithOwner';

export interface OrpcMiddlewareOpts {
  readonly next: () => Promise<unknown>;
}

export type OrpcMiddleware = <TOpts extends OrpcMiddlewareOpts>(opts: TOpts) => Promise<unknown>;

export function teamMiddleware(team: string): OrpcMiddleware {
  return ({ next }) => runWithOwner(team, () => next());
}
