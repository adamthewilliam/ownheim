import { runWithOwner } from '@strays/runtime/runWithOwner';

export type HonoNext = () => Promise<void>;

export type HonoMiddleware = (c: unknown, next: HonoNext) => Promise<void>;

export function teamMiddleware(team: string): HonoMiddleware {
  return (_c, next) => runWithOwner(team, () => next());
}
