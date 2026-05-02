import { ownerMiddleware } from './ownerMiddleware.ts';

export interface OrpcProcedureBuilder {
  use(middleware: ReturnType<typeof ownerMiddleware>): this;
}

export function ownedProcedure<T extends OrpcProcedureBuilder>(builder: T, owner: string): T {
  return builder.use(ownerMiddleware(owner));
}
