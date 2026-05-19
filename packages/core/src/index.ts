export { defineStrays } from './defineStrays.ts';
export { OwnedError, isOwnedError, getErrorOwner } from './OwnedError.ts';
export { OWNER_TAG, type OwnerTag } from './symbols.ts';
export type {
  Team,
  Owner,
  TeamId,
  SharedRule,
  StraysConfig,
  ResolvedOwnership,
  ResolvedOwner,
} from './types.ts';

export {
  runWithOwner,
  currentOwner,
  withOwnerScope,
  resolveOwner,
  resolveOwnerWithSource,
  type NextThunk,
  type OwnerSource,
  type OwnerResolution,
  type ResolveOwnerInput,
} from './ownership.ts';
export { lookupCallerOwner } from './resolution/lookupCallerOwner.ts';
export { walkOwnedErrorChain, isOwnedShape } from './resolution/walkOwnedErrorChain.ts';
export {
  callerFrameSource,
  fromSentryFrames,
  findOwnedFrame,
  isVendorFrame,
  parseFrameFile,
  type FrameSource,
  type SentryFrame,
  type SentryStacktrace,
} from './resolution/frames.ts';

export { ManifestRegistry, type OwnershipManifest } from './manifest/ManifestRegistry.ts';
export {
  getDefaultRegistry,
  setDefaultRegistry,
  resetDefaultRegistry,
  registerOwnershipManifest,
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
