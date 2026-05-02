import { fromSentryFrames, type SentryStacktrace } from '@strays/runtime/fromSentryFrames';
import { resolveOwner } from '@strays/runtime/resolveOwner';

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
}

export function installSentry(client: SentryClient, options: InstallOptions = {}): void {
  const fallback = options.fallback ?? 'unowned';
  const tagKey = options.tagKey ?? 'team';

  client.addEventProcessor((event, hint) => {
    const stacktrace = event.exception?.values?.[0]?.stacktrace;
    const team = resolveOwner({
      error: hint?.originalException,
      frameSource: fromSentryFrames(stacktrace),
      fallback,
    });
    event.tags = { ...event.tags, [tagKey]: team };
    return event;
  });
}
