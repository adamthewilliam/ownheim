import { fromSentryFrames, type SentryStacktrace } from '@strays/runtime/resolution/fromSentryFrames';
import { resolveOwnerWithSource } from '@strays/runtime/resolution/resolveOwner';
import { resolveTagOptions, type TagOptions } from '@strays/runtime/tracing/resolveTagOptions';

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

export function installSentry(client: SentryClient, options: InstallOptions = {}): void {
  const { fallback, tagKey, sourceTagKey, emitSource } = resolveTagOptions(options);

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
