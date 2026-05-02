import { Logger as EffectLogger } from 'effect';
import { formatOwnedLogEntry, type LogLevel } from '@strays/runtime/formatOwnedLogEntry';
import { stdoutJsonSink, type LogSink } from '@strays/runtime/LogSink';

const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

const levelFromLabel = (label: string): LogLevel =>
  LOG_LEVELS.find((l) => l === label.toLowerCase()) ?? 'info';

export const makeOwnershipLogger = (sink: LogSink = stdoutJsonSink) =>
  EffectLogger.make(({ logLevel, message, annotations, cause }) => {
    const annotationsObj = Object.fromEntries(annotations);
    const scopeOwner =
      typeof annotationsObj.team === 'string' ? annotationsObj.team : undefined;
    const level = levelFromLabel(logLevel.label);
    const error = extractCauseError(cause);
    const line = formatOwnedLogEntry({
      level,
      message: typeof message === 'string' ? message : String(message),
      fields: annotationsObj,
      ...(error === undefined ? {} : { error }),
      ...(scopeOwner === undefined ? {} : { scopeOwner }),
    });
    sink.write(line, level);
  });

export const ownershipLogger = makeOwnershipLogger();
export const OwnershipLoggerLayer = EffectLogger.replace(EffectLogger.defaultLogger, ownershipLogger);

export function extractCauseError(cause: unknown): unknown {
  if (cause === null || cause === undefined) return undefined;
  if (typeof cause !== 'object') return undefined;

  const c = cause as { _tag?: string; error?: unknown; defect?: unknown };
  if (c._tag === 'Fail') return c.error;
  if (c._tag === 'Die') return c.defect;
  return undefined;
}
