export { defineStrays } from './defineStrays.ts';
export { OwnedError, isOwnedError, getErrorOwner } from './OwnedError.ts';
export { OWNER_TAG, type OwnerTag } from './symbols.ts';
export type { Owner, OwnerId, Rule, StraysConfig, ResolvedOwner } from './types.ts';

export { runWithOwner } from './scope/runWithOwner.ts';
export { currentOwner } from './scope/currentOwner.ts';
export { withOwnerScope, type NextThunk } from './scope/withOwnerScope.ts';
export { ownerStore } from './scope/store.ts';

export {
  resolveOwner,
  resolveOwnerWithSource,
  type OwnerSource,
  type OwnerResolution,
  type ResolveOwnerInput,
} from './resolution/resolveOwner.ts';
export { lookupCallerOwner } from './resolution/lookupCallerOwner.ts';
export { walkOwnedErrorChain, isOwnedShape } from './resolution/walkOwnedErrorChain.ts';
export { callerFrameSource, type FrameSource } from './resolution/callerFrameSource.ts';
export {
  fromSentryFrames,
  type SentryFrame,
  type SentryStacktrace,
} from './resolution/fromSentryFrames.ts';

export { ManifestRegistry, type OwnershipManifest } from './manifest/ManifestRegistry.ts';
export {
  getDefaultRegistry,
  setDefaultRegistry,
  resetDefaultRegistry,
} from './manifest/defaultRegistry.ts';

export {
  createLogger,
  type Logger,
  type LogRecord,
  type LogValue,
  type CreateLoggerOptions,
} from './logging/createLogger.ts';
export {
  formatOwnedLogEntry,
  type LogLevel,
  type OwnedLogEntry,
  type FormattedLogLine,
} from './logging/formatOwnedLogEntry.ts';
export {
  type LogSink,
  stdoutJsonSink,
  makeMemorySink,
  type MemorySink,
} from './logging/LogSink.ts';
export {
  getDefaultLogSink,
  setDefaultLogSink,
  resetDefaultLogSink,
} from './logging/defaultLogSink.ts';

export {
  createTracer,
  type Tracer,
  type TracedSpan,
  type SpanFactory,
  type CreateTracerOptions,
} from './tracing/createTracer.ts';
export {
  resolveTagOptions,
  type TagOptions,
  type ResolvedTagOptions,
  DEFAULT_TAG_KEY,
  DEFAULT_SOURCE_TAG_KEY,
  DEFAULT_FALLBACK,
} from './tracing/resolveTagOptions.ts';
