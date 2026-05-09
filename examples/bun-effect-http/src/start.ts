import { runWithOwner } from '@strays/core/ownership';
import { createLogger } from '@strays/core/logging/createLogger';
import { adminRefund } from './billing/admin/refund.ts';
import { chargeInvoice } from './billing/charge.ts';
import { requireSession } from './auth/session.ts';

const logger = createLogger('Platform');

function ownerForPath(path: string): string {
  if (path.startsWith('/billing/admin')) return 'Platform';
  if (path.startsWith('/billing')) return 'Billing';
  if (path.startsWith('/auth')) return 'Identity';
  return 'Platform';
}

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  fetch(req) {
    const url = new URL(req.url);
    const owner = ownerForPath(url.pathname);

    return runWithOwner(owner, () => {
      try {
        if (url.pathname.startsWith('/billing/admin/refund')) {
          const amount = adminRefund(50);
          logger.info({ msg: 'refunded', amount });
          return Response.json({ ok: true, amount });
        }
        if (url.pathname.startsWith('/billing/charge')) {
          const result = chargeInvoice(100);
          logger.info({ msg: 'charged', amount: result.amount });
          return Response.json(result);
        }
        if (url.pathname.startsWith('/auth/session')) {
          const token = requireSession(url.searchParams.get('token') ?? undefined);
          logger.info({ msg: 'authed', token });
          return Response.json({ ok: true, token });
        }
        if (url.pathname === '/trigger-error') {
          chargeInvoice(-1);
          return Response.json({ unreachable: true });
        }
        return new Response('not found', { status: 404 });
      } catch (err) {
        logger.error({ msg: 'request failed' }, err);
        return Response.json({ error: String(err) }, { status: 500 });
      }
    });
  },
});

console.log(`strays example listening on :${server.port}`);
