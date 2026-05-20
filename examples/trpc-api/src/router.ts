import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { currentEntrypointOwner } from '@ownheim/core/ownership';
import { entrypointProcedure } from '@ownheim/trpc';
import { createInvoice } from './billing/service.ts';
import { getUser } from './identity/service.ts';

const t = initTRPC.create();

const billingProcedure = entrypointProcedure(t.procedure, 'Billing');
const identityProcedure = entrypointProcedure(t.procedure, 'Identity');

export const appRouter = t.router({
  createInvoice: billingProcedure
    .input(z.object({ customerId: z.string(), amount: z.number() }))
    .mutation(({ input }) => createInvoice(input)),

  getUser: identityProcedure.input(z.string()).query(({ input }) => getUser(input)),

  whoOwnsThisEntrypoint: billingProcedure.query(() => ({
    entrypointTeam: currentEntrypointOwner(),
  })),
});

export type AppRouter = typeof appRouter;

console.log('tRPC router exports owner-tagged Billing and Identity procedures');
