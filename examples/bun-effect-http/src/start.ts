import { Cause, Effect, Exit, Logger as EffectLogger } from 'effect';
import { registerOwnershipManifest, runWithEntrypointOwner } from '@ownheim/core';
import { resolveProjectedOwnershipTags } from '@ownheim/core/tracing/projectOwnership';
import manifest from '../dist/ownheim-manifest.json' with { type: 'json' };
import { adminRefund } from './billing/admin/refund.ts';
import { chargeInvoice } from './billing/charge.ts';
import { requireSession } from './auth/session.ts';

registerOwnershipManifest(manifest);

const logger = EffectLogger.make(({ logLevel, message, annotations, cause }) => {
  const fields = Object.fromEntries(annotations);
  const error = Cause.isCause(cause) ? Cause.pretty(cause) : undefined;
  console.log(
    JSON.stringify({
      level: logLevel.label.toLowerCase(),
      msg: String(message),
      ...fields,
      ...(error === undefined ? {} : { error }),
    }),
  );
});

function ownerForPath(path: string): string {
  if (path.startsWith('/billing/admin')) return 'Platform';
  if (path.startsWith('/billing')) return 'Billing';
  if (path.startsWith('/auth')) return 'Identity';
  return 'Platform';
}

const toResponse = <A>(exit: Exit.Exit<A, unknown>): Response => {
  if (Exit.isSuccess(exit)) return Response.json(exit.value);

  const error = Cause.pretty(exit.cause);
  return Response.json(
    {
      error,
      // Non-Effect loggers can use the same projection helper directly.
      ownership: resolveProjectedOwnershipTags(),
    },
    { status: 500 },
  );
};

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  async fetch(req) {
    const url = new URL(req.url);
    const owner = ownerForPath(url.pathname);

    return runWithEntrypointOwner(owner, async () => {
      const program = (() => {
        if (url.pathname.startsWith('/billing/admin/refund')) {
          return adminRefund(50).pipe(
            Effect.tap((amount) => Effect.logInfo('refunded', { amount })),
            Effect.map((amount) => ({ ok: true as const, amount })),
          );
        }

        if (url.pathname.startsWith('/billing/charge')) {
          return chargeInvoice(100).pipe(
            Effect.tap((result) => Effect.logInfo('charged', { amount: result.amount })),
          );
        }

        if (url.pathname.startsWith('/auth/session')) {
          return requireSession(url.searchParams.get('token') ?? undefined).pipe(
            Effect.tap((token) => Effect.logInfo('authed', { token })),
            Effect.map((token) => ({ ok: true as const, token })),
          );
        }

        if (url.pathname === '/trigger-error') {
          return chargeInvoice(-1);
        }

        return Effect.succeed(new Response('not found', { status: 404 }));
      })();

      const exit = await Effect.runPromiseExit(
        program.pipe(Effect.provide(EffectLogger.replace(EffectLogger.defaultLogger, logger))),
      );

      if (Exit.isSuccess(exit) && exit.value instanceof Response) return exit.value;
      return toResponse(exit);
    });
  },
});

console.log(`ownheim Effect example listening on :${server.port}`);
