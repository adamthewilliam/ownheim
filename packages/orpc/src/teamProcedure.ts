import { teamMiddleware } from './teamMiddleware.ts';

export interface OrpcProcedureBuilder {
  use(middleware: ReturnType<typeof teamMiddleware>): this;
}

export function teamProcedure<T extends OrpcProcedureBuilder>(builder: T, team: string): T {
  return builder.use(teamMiddleware(team));
}
