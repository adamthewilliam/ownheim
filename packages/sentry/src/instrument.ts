import { type FrameSource } from '@ownheim/core/resolution/frames';
import { resolveProjectedOwnershipTags } from '@ownheim/core/tracing/projectOwnership';
import { type TagOptions } from '@ownheim/core/tracing/resolveTagOptions';

export interface SentryFrame {
  filename?: string;
  abs_path?: string;
}

export interface SentryStacktrace {
  frames?: SentryFrame[];
}

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

export type InstrumentOptions = TagOptions;

const INSTRUMENTED = Symbol.for('ownheim.sentry.instrumented');

type InstrumentedSentryClient = SentryClient & { [INSTRUMENTED]?: true };

function fromSentryFrames(stacktrace: SentryStacktrace | undefined): FrameSource | undefined {
  if (!stacktrace?.frames) return undefined;
  return {
    *frames() {
      for (const frame of [...stacktrace.frames!].reverse()) {
        const file = frame.abs_path ?? frame.filename;
        if (file) yield file;
      }
    },
  };
}

export function instrumentSentry(client: SentryClient, options: InstrumentOptions = {}): void {
  const instrumentedClient = client as InstrumentedSentryClient;
  if (instrumentedClient[INSTRUMENTED]) return;
  instrumentedClient[INSTRUMENTED] = true;

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
