import { runWithOwner } from '@strays/runtime/runWithOwner';

export interface TrpcMiddlewareNext {
  (): Promise<unknown>;
  <T>(opts: { ctx: T }): Promise<unknown>;
}

export interface TrpcMiddlewareOpts {
  readonly next: TrpcMiddlewareNext;
}

export type TrpcMiddleware = <TOpts extends TrpcMiddlewareOpts>(opts: TOpts) => Promise<unknown>;

export function teamMiddleware(team: string): TrpcMiddleware {
  return ({ next }) => runWithOwner(team, () => next());
}
