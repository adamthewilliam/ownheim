export { defineOwnheim } from './defineOwnheim.ts';
export { OwnedError, isOwnedError, getResponderTeam, withResponderTeam } from './OwnedError.ts';
export { OWNER_TAG, type OwnerTag } from './symbols.ts';
export type {
  Team,
  Owner,
  TeamId,
  SharedRule,
  OwnheimConfig,
  ResolvedOwnership,
  ResolvedOwner,
} from './types.ts';

export {
  runWithEntrypointOwner,
  currentEntrypointOwner,
  withEntrypointOwnerScope,
  createEntrypointOwnerAdapter,
  resolveOwnership,
  type NextThunk,
  type CodeOwnerSource,
  type OwnershipContext,
  type OwnershipSources,
  type OwnershipResolution,
  type ResolveOwnershipInput,
} from './ownership.ts';
export { lookupCallerOwner } from './resolution/lookupCallerOwner.ts';
export { walkResponderTeamChain, isOwnedShape } from './resolution/walkOwnedErrorChain.ts';
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
  DEFAULT_CODE_TEAM_FALLBACK,
  DEFAULT_ENTRYPOINT_TEAM_TAG,
  DEFAULT_CODE_TEAM_TAG,
  DEFAULT_RESPONDER_TEAM_TAG,
} from './tracing/resolveTagOptions.ts';
export {
  ownershipContextToTags,
  resolveOwnershipTags,
  applyOwnershipTags,
  type OwnershipTagNames,
  type ResolveOwnershipTagsInput,
  type OwnershipTags,
} from './tracing/ownershipTags.ts';
export {
  projectOwnershipToTags,
  resolveProjectedOwnershipContext,
  resolveProjectedOwnershipTags,
  applyProjectedOwnership,
  type ProjectOwnershipInput,
} from './tracing/projectOwnership.ts';
