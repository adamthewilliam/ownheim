import { teamMiddleware } from './teamMiddleware.ts';

export interface TrpcProcedureBuilder {
  use(middleware: ReturnType<typeof teamMiddleware>): this;
}

export function teamProcedure<T extends TrpcProcedureBuilder>(builder: T, team: string): T {
  return builder.use(teamMiddleware(team));
}
