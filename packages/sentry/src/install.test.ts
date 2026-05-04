import { afterEach, describe, expect, it } from 'bun:test';
import { OwnedError } from '@strays/core/OwnedError';
import { ManifestRegistry, type OwnershipManifest } from '@strays/runtime/manifest/ManifestRegistry';
import { resetDefaultRegistry, setDefaultRegistry } from '@strays/runtime/manifest/defaultRegistry';
import { runWithOwner } from '@strays/runtime/scope/runWithOwner';
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

  it('omits team_source by default to keep cardinality minimal', () => {
    const { processors, client } = makeMockClient();
    installSentry(client);

    const event = runWithOwner('Billing', () => processors[0]!({}, {}));
    expect(event?.tags?.team).toBe('Billing');
    expect(event?.tags?.team_source).toBeUndefined();
  });

  it('emits team_source: "error" when opted in and an OwnedError is the original exception', () => {
    const { processors, client } = makeMockClient();
    installSentry(client, { emitSource: true });
    const err = new OwnedError('boom', 'Billing');

    const event = processors[0]!({}, { originalException: err });
    expect(event?.tags?.team).toBe('Billing');
    expect(event?.tags?.team_source).toBe('error');
  });

  it('emits team_source: "scope" when opted in and scope wins over a plain error', () => {
    const { processors, client } = makeMockClient();
    installSentry(client, { emitSource: true });

    const event = runWithOwner('Identity', () =>
      processors[0]!({}, { originalException: new Error('plain') }),
    );
    expect(event?.tags?.team).toBe('Identity');
    expect(event?.tags?.team_source).toBe('scope');
  });

  it('emits team_source: "frame" when opted in and manifest resolves via Sentry frames', () => {
    loadManifest({ version: 1, files: { 'src/billing/charge.ts': 'Billing' } });
    const { processors, client } = makeMockClient();
    installSentry(client, { emitSource: true });

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
    expect(event?.tags?.team_source).toBe('frame');
  });

  it('emits team_source: "fallback" when opted in and nothing resolves', () => {
    const { processors, client } = makeMockClient();
    installSentry(client, { emitSource: true, fallback: 'platform-default' });

    const event = processors[0]!({}, { originalException: new Error('orphan') });
    expect(event?.tags?.team).toBe('platform-default');
    expect(event?.tags?.team_source).toBe('fallback');
  });

  it('honours a custom sourceTagKey when emitSource is opted in', () => {
    const { processors, client } = makeMockClient();
    installSentry(client, { emitSource: true, sourceTagKey: 'sentry.team_source' });

    const event = runWithOwner('Billing', () => processors[0]!({}, {}));
    expect(event?.tags?.['sentry.team_source']).toBe('scope');
  });
});
