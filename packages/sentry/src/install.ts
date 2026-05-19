import { fromSentryFrames, type SentryStacktrace } from '@ownheim/core/resolution/frames';
import { resolveOwnership } from '@ownheim/core/ownership';
import { resolveTagOptions, type TagOptions } from '@ownheim/core/tracing/resolveTagOptions';

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

  const { fallbackCodeTeam, tags: tagKeys } = resolveTagOptions(options);

  client.addEventProcessor((event, hint) => {
    const stacktrace = event.exception?.values?.[0]?.stacktrace;
    const { ownership } = resolveOwnership({
      error: hint?.originalException,
      frameSource: fromSentryFrames(stacktrace),
      fallbackCodeTeam,
    });
    const tags: Record<string, string> = { ...event.tags };
    if (ownership.entrypointTeam !== undefined) tags[tagKeys.entrypointTeam] = ownership.entrypointTeam;
    if (ownership.codeTeam !== undefined) tags[tagKeys.codeTeam] = ownership.codeTeam;
    if (ownership.responderTeam !== undefined) tags[tagKeys.responderTeam] = ownership.responderTeam;
    event.tags = tags;
    return event;
  });
}
