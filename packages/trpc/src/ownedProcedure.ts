import { ownerMiddleware } from './ownerMiddleware.ts';

export interface TrpcProcedureBuilder {
  use(middleware: ReturnType<typeof ownerMiddleware>): this;
}

export function ownedProcedure<T extends TrpcProcedureBuilder>(builder: T, owner: string): T {
  return builder.use(ownerMiddleware(owner));
}
