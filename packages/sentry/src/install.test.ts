import { afterEach, describe, expect, it } from 'bun:test';
import { OwnedError } from '@strays/core/OwnedError';
import { ManifestRegistry, type OwnershipManifest } from '@strays/core/manifest/ManifestRegistry';
import { resetDefaultRegistry, setDefaultRegistry } from '@strays/core/manifest/defaultRegistry';
import { runWithEntrypointOwner } from '@strays/core/ownership';
import { installSentry, type SentryClient, type SentryEventProcessor } from './install.ts';

function loadManifest(manifest: OwnershipManifest): void {
  setDefaultRegistry(ManifestRegistry.fromManifest(manifest));
}

function makeMockClient() {
  const processors: SentryEventProcessor[] = [];
  const client: SentryClient = {
    addEventProcessor(p) {
      processors.push(p);
    },
  };
  return { processors, client };
}

afterEach(() => resetDefaultRegistry());

describe('installSentry', () => {
  it('tags events with responder ownership from OwnedError', () => {
    const { processors, client } = makeMockClient();
    installSentry(client);
    const err = new OwnedError('boom', { responderTeam: 'Billing' });

    const event = processors[0]!({}, { originalException: err });
    expect(event?.tags?.['strays.responder_team']).toBe('Billing');
    expect(event?.tags?.['strays.code_team']).toBe('unowned');
  });

  it('tags events with entrypoint ownership from scope', () => {
    const { processors, client } = makeMockClient();
    installSentry(client);

    const event = runWithEntrypointOwner('Identity', () =>
      processors[0]!({}, { originalException: new Error('plain') }),
    );
    expect(event?.tags?.['strays.entrypoint_team']).toBe('Identity');
  });

  it('uses manifest lookup via stack frames for code ownership', () => {
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

    expect(event?.tags?.['strays.code_team']).toBe('Billing');
  });

  it('uses fallbackCodeTeam when nothing resolves', () => {
    const { processors, client } = makeMockClient();
    installSentry(client, { fallbackCodeTeam: 'platform-default' });

    const event = processors[0]!({}, { originalException: new Error('orphan') });
    expect(event?.tags?.['strays.code_team']).toBe('platform-default');
  });

  it('honours custom tag keys', () => {
    const { processors, client } = makeMockClient();
    installSentry(client, { tags: { entrypointTeam: 'sentry.entrypoint_team' } });

    const event = runWithEntrypointOwner('Billing', () => processors[0]!({}, {}));
    expect(event?.tags?.['sentry.entrypoint_team']).toBe('Billing');
  });

  it('is idempotent', () => {
    const { processors, client } = makeMockClient();
    installSentry(client);
    installSentry(client);

    expect(processors).toHaveLength(1);
  });
});
