/**
 * Shared defaults for telemetry-adapter tag/attribute options.
 *
 * The string values are the on-the-wire contract — every span/event/log line
 * emitted via a strays adapter carries `team` (or `team_source` when opted
 * in) by default. Centralising these keeps the contract in one place even
 * as adapters evolve.
 */
export const DEFAULT_FALLBACK = 'unowned';
export const DEFAULT_TAG_KEY = 'team';
export const DEFAULT_SOURCE_TAG_KEY = 'team_source';

/**
 * Option shape for Datadog and Sentry adapters (vendors that call them
 * "tags"). OTel keeps its own naming (`attributeKey` / `sourceAttributeKey`)
 * but consumes the same default constants above.
 */
export interface TagOptions {
  readonly fallback?: string;
  readonly tagKey?: string;
  readonly sourceTagKey?: string;
  readonly emitSource?: boolean;
}

export interface ResolvedTagOptions {
  readonly fallback: string;
  readonly tagKey: string;
  readonly sourceTagKey: string;
  readonly emitSource: boolean;
}

export function resolveTagOptions(options: TagOptions): ResolvedTagOptions {
  return {
    fallback: options.fallback ?? DEFAULT_FALLBACK,
    tagKey: options.tagKey ?? DEFAULT_TAG_KEY,
    sourceTagKey: options.sourceTagKey ?? DEFAULT_SOURCE_TAG_KEY,
    emitSource: options.emitSource ?? false,
  };
}
