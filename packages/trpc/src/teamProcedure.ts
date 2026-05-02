import { teamMiddleware, type TrpcMiddleware } from './teamMiddleware.ts';

export interface TrpcProcedureBuilder {
  use(middleware: TrpcMiddleware): this;
}

export function teamProcedure<T extends TrpcProcedureBuilder>(builder: T, team: string): T {
  return builder.use(teamMiddleware(team));
}
