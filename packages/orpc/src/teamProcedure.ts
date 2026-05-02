import { teamMiddleware, type OrpcMiddleware } from './teamMiddleware.ts';

export interface OrpcProcedureBuilder {
  use(middleware: OrpcMiddleware): this;
}

export function teamProcedure<T extends OrpcProcedureBuilder>(builder: T, team: string): T {
  return builder.use(teamMiddleware(team));
}
