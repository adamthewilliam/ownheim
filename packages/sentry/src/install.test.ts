import { afterEach, describe, expect, it } from 'bun:test';
import { OwnedError } from '@strays/core/OwnedError';
import { clearManifest, loadManifest } from '@strays/runtime/manifest';
import { runWithOwner } from '@strays/runtime/runWithOwner';
import { installSentry, type SentryClient, type SentryEventProcessor } from './install.ts';

function makeMockClient() {
  const processors: SentryEventProcessor[] = [];
  const client: SentryClient = {
    addEventProcessor(p) {
      processors.push(p);
    },
  };
  return { processors, client };
}

afterEach(() => clearManifest());

describe('installSentry', () => {
  it('tags events with the OwnedError owner when present', () => {
    const { processors, client } = makeMockClient();
    installSentry(client);
    const err = new OwnedError('boom', 'Billing');

    const event = processors[0]!({}, { originalException: err });
    expect(event?.tags?.team).toBe('Billing');
  });

  it('falls back to scope when error is plain', () => {
    const { processors, client } = makeMockClient();
    installSentry(client);
    const plain = new Error('plain');

    const event = runWithOwner('Identity', () =>
      processors[0]!({}, { originalException: plain }),
    );
    expect(event?.tags?.team).toBe('Identity');
  });

  it('falls back to manifest lookup via stack frames', () => {
    loadManifest({ version: 1, files: { 'src/billing/charge.ts': 'Billing' } });
    const { processors, client } = makeMockClient();
    installSentry(client);

    const event = processors[0]!(
      {
        exception: {
          values: [
            {
              stacktrace: {
                frames: [
                  { filename: '/path/to/node_modules/lodash/index.js' },
                  { filename: 'src/billing/charge.ts' },
                ],
              },
            },
          ],
        },
      },
      { originalException: new Error('plain') },
    );

    expect(event?.tags?.team).toBe('Billing');
  });

  it('uses fallback when nothing resolves', () => {
    const { processors, client } = makeMockClient();
    installSentry(client, { fallback: 'platform-default' });

    const event = processors[0]!({}, { originalException: new Error('orphan') });
    expect(event?.tags?.team).toBe('platform-default');
  });

  it('honours a custom tag key', () => {
    const { processors, client } = makeMockClient();
    installSentry(client, { tagKey: 'sentry.team' });

    const event = runWithOwner('Billing', () => processors[0]!({}, {}));
    expect(event?.tags?.['sentry.team']).toBe('Billing');
  });
});
