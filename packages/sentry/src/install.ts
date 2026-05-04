import { fromSentryFrames, type SentryStacktrace } from '@strays/runtime/fromSentryFrames';
import { resolveOwnerWithSource } from '@strays/runtime/resolveOwnerWithSource';

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

export interface InstallOptions {
  readonly fallback?: string;
  readonly tagKey?: string;
  readonly sourceTagKey?: string;
  readonly emitSource?: boolean;
}

export function installSentry(client: SentryClient, options: InstallOptions = {}): void {
  const fallback = options.fallback ?? 'unowned';
  const tagKey = options.tagKey ?? 'team';
  const sourceTagKey = options.sourceTagKey ?? 'team_source';
  const emitSource = options.emitSource ?? false;

  client.addEventProcessor((event, hint) => {
    const stacktrace = event.exception?.values?.[0]?.stacktrace;
    const { owner, source } = resolveOwnerWithSource({
      error: hint?.originalException,
      frameSource: fromSentryFrames(stacktrace),
      fallback,
    });
    const tags: Record<string, string> = { ...event.tags, [tagKey]: owner };
    if (emitSource) tags[sourceTagKey] = source;
    event.tags = tags;
    return event;
  });
}
