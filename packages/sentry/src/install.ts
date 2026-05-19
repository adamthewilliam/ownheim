import { fromSentryFrames, type SentryStacktrace } from '@ownheim/core/resolution/frames';
import { resolveProjectedOwnershipTags } from '@ownheim/core/tracing/projectOwnership';
import { type TagOptions } from '@ownheim/core/tracing/resolveTagOptions';

export interface SentryEvent {
  tags?: Record<string, string>;
  exception?: { values?: Array<{ stacktrace?: SentryStacktrace }> };
}

export interface SentryEventHint {
  originalException?: unknown;
}

export type SentryEventProcessor = (
  event: SentryEvent,
  hint?: SentryEventHint,
) => SentryEvent | null;

export interface SentryClient {
  addEventProcessor(processor: SentryEventProcessor): void;
}

export type InstallOptions = TagOptions;

const INSTALLED = Symbol.for('ownheim.sentry.installed');

type InstalledSentryClient = SentryClient & { [INSTALLED]?: true };

export function installSentry(client: SentryClient, options: InstallOptions = {}): void {
  const installedClient = client as InstalledSentryClient;
  if (installedClient[INSTALLED]) return;
  installedClient[INSTALLED] = true;

  client.addEventProcessor((event, hint) => {
    const stacktrace = event.exception?.values?.[0]?.stacktrace;
    event.tags = {
      ...event.tags,
      ...resolveProjectedOwnershipTags({
        ...options,
        error: hint?.originalException,
        frameSource: fromSentryFrames(stacktrace),
      }),
    };
    return event;
  });
}
