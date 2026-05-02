import { runWithOwner } from '@strays/runtime/runWithOwner';

export type ExpressNext = (err?: unknown) => void;

export type ExpressMiddleware = (req: unknown, res: unknown, next: ExpressNext) => void;

export function owned(team: string): ExpressMiddleware {
  return (_req, _res, next) => {
    runWithOwner(team, () => next());
  };
}
