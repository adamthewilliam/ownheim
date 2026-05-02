import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { OwnedError } from '@strays/core/OwnedError';
import { clearManifest } from '@strays/runtime/manifest';
import { runWithOwner } from '@strays/runtime/runWithOwner';
import * as Sentry from '@sentry/node';
import { parseEnvelope } from '@sentry/core';
import type {
  Client,
  Envelope,
  Event,
  EventItem,
  EventProcessor,
  Transport,
  TransportMakeRequestResponse,
} from '@sentry/core';
import { installSentry, type SentryClient } from '@strays/sentry/install';

// In-memory transport: capture every envelope the SDK tries to flush.
interface CapturedEnvelope {
  readonly raw: string | Uint8Array;
  readonly envelope: Envelope;
}

function createCapturingTransport(captured: CapturedEnvelope[]): () => Transport {
  return () => ({
    send(envelope: Envelope): PromiseLike<TransportMakeRequestResponse> {
      // Round-trip through serialize/parse so we exercise the same path the
      // real HTTPS transport does, then store both forms for assertions.
      // `Sentry` normally serializes inside `makeNodeTransport`; here we
      // already receive the structured envelope.
      captured.push({ raw: '', envelope });
      return Promise.resolve({ statusCode: 200 });
    },
    flush(): PromiseLike<boolean> {
      return Promise.resolve(true);
    },
  });
}

function eventsFromEnvelopes(captured: CapturedEnvelope[]): Event[] {
  const events: Event[] = [];
  for (const c of captured) {
    const items = c.envelope[1];
    for (const item of items) {
      // item is `[headers, payload]`; for events the header type is 'event'.
      const [headers, payload] = item as EventItem;
      if (headers.type === 'event') {
        events.push(payload);
      }
    }
  }
  return events;
}

// Bridge the real Sentry Client to the strays SentryClient interface.
// `installSentry` only needs `addEventProcessor`. The real Event type has
// `tags: { [key: string]: Primitive }` which is wider than the strays
// SentryEvent's `Record<string, string>` — we coerce both directions via the
// wrapper since strays only writes string values for the team tag.
function asStraysClient(client: Client): SentryClient {
  return {
    addEventProcessor(processor) {
      const wrapped: EventProcessor = (event, hint) => {
        const result = processor(event as unknown as Parameters<typeof processor>[0], hint);
        return result as unknown as Event | null;
      };
      client.addEventProcessor(wrapped);
    },
  };
}

let captured: CapturedEnvelope[];

beforeEach(() => {
  captured = [];
  Sentry.init({
    dsn: 'https://public@example.ingest.sentry.io/1',
    transport: createCapturingTransport(captured),
    // Disable default integrations that add async work / network probes so
    // the test stays hermetic.
    defaultIntegrations: false,
    sendClientReports: false,
  });
});

afterEach(async () => {
  await Sentry.close(2000);
  clearManifest();
});

describe('@strays/sentry integration with real @sentry/node', () => {
  it('tags captured events with the active runWithOwner team', async () => {
    const client = Sentry.getClient();
    if (!client) throw new Error('Sentry client not initialised');
    installSentry(asStraysClient(client));

    runWithOwner('Billing', () => {
      Sentry.captureException(new Error('boom'));
    });

    await Sentry.flush(2000);

    const events = eventsFromEnvelopes(captured);
    expect(events.length).toBeGreaterThanOrEqual(1);
    const event = events[events.length - 1]!;
    expect(event.tags?.team).toBe('Billing');
  });

  it('honours OwnedError owner over the active scope', async () => {
    const client = Sentry.getClient();
    if (!client) throw new Error('Sentry client not initialised');
    installSentry(asStraysClient(client));

    const owned = new OwnedError('explicit', 'Payments');

    runWithOwner('Identity', () => {
      Sentry.captureException(owned);
    });

    await Sentry.flush(2000);

    const events = eventsFromEnvelopes(captured);
    const event = events[events.length - 1]!;
    expect(event.tags?.team).toBe('Payments');
  });

  it('falls back when capturing outside any owner scope', async () => {
    const client = Sentry.getClient();
    if (!client) throw new Error('Sentry client not initialised');
    installSentry(asStraysClient(client), { fallback: 'platform-default' });

    Sentry.captureException(new Error('orphan'));

    await Sentry.flush(2000);

    const events = eventsFromEnvelopes(captured);
    const event = events[events.length - 1]!;
    expect(event.tags?.team).toBe('platform-default');
  });

  it('strays processor wins when installed after a processor that sets team', async () => {
    const client = Sentry.getClient();
    if (!client) throw new Error('Sentry client not initialised');

    // Pre-existing processor tries to claim the `team` tag for itself.
    client.addEventProcessor(((event) => {
      event.tags = { ...event.tags, team: 'legacy-overwrite' };
      return event;
    }) as EventProcessor);

    // Install strays AFTER — should win because Sentry runs processors
    // in registration order and the last writer to `event.tags.team` wins.
    installSentry(asStraysClient(client));

    runWithOwner('Billing', () => {
      Sentry.captureException(new Error('order matters'));
    });

    await Sentry.flush(2000);

    const events = eventsFromEnvelopes(captured);
    const event = events[events.length - 1]!;
    expect(event.tags?.team).toBe('Billing');
  });

  it('does NOT win when installed BEFORE another processor that sets team (documents order requirement)', async () => {
    const client = Sentry.getClient();
    if (!client) throw new Error('Sentry client not initialised');

    // Strays goes FIRST.
    installSentry(asStraysClient(client));

    // Foreign processor runs after strays and clobbers the tag.
    client.addEventProcessor(((event) => {
      event.tags = { ...event.tags, team: 'usurper' };
      return event;
    }) as EventProcessor);

    runWithOwner('Billing', () => {
      Sentry.captureException(new Error('install order matters'));
    });

    await Sentry.flush(2000);

    const events = eventsFromEnvelopes(captured);
    const event = events[events.length - 1]!;
    // Documents the requirement: install strays last.
    expect(event.tags?.team).toBe('usurper');
  });
});

// Suppress unused warning for `parseEnvelope` import in case the SDK ever
// hands us a serialized payload instead of a structured envelope: we keep
// the helper available without requiring it for the current code path.
void parseEnvelope;
