import { entrypointOwner } from './ownerMiddleware.ts';

export interface OrpcProcedureBuilder {
  use(middleware: ReturnType<typeof entrypointOwner>): this;
}

export function entrypointProcedure<T extends OrpcProcedureBuilder>(builder: T, team: string): T {
  return builder.use(entrypointOwner(team));
}
