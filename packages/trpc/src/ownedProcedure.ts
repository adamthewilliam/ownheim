import { entrypointOwner } from './ownerMiddleware.ts';

export interface TrpcProcedureBuilder {
  use(middleware: ReturnType<typeof entrypointOwner>): this;
}

export function entrypointProcedure<T extends TrpcProcedureBuilder>(builder: T, team: string): T {
  return builder.use(entrypointOwner(team));
}
