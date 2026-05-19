import { getDefaultLogSink } from './defaultLogSink.ts';
import { formatOwnedLogEntry, type LogLevel } from './formatOwnedLogEntry.ts';
import type { LogSink } from './LogSink.ts';
import type { ManifestRegistry } from '../manifest/ManifestRegistry.ts';
import { resolveOwnership } from '../ownership.ts';

export type LogValue =
  | string
  | number
  | boolean
  | null
  | readonly LogValue[]
  | { readonly [key: string]: LogValue };

export interface LogRecord {
  readonly msg: string;
  readonly [key: string]: unknown;
}

export interface Logger {
  info(record: LogRecord): void;
  warn(record: LogRecord): void;
  error(record: LogRecord, err?: unknown): void;
}

export interface CreateLoggerOptions {
  readonly sink?: LogSink;
  readonly fallbackCodeTeam?: string;
  readonly registry?: ManifestRegistry;
}

export function createLogger(moduleOwner: string, options: CreateLoggerOptions = {}): Logger {
  const sink = options.sink ?? getDefaultLogSink();
  const fallbackCodeTeam = options.fallbackCodeTeam ?? 'unowned';
  const normalisedModuleOwner = moduleOwner === '' ? undefined : moduleOwner;

  const emit = (level: LogLevel, record: LogRecord, err?: unknown) => {
    const { msg, ...fields } = record;
    const { ownership } = resolveOwnership({
      ...(err === undefined ? {} : { error: err }),
      ...(normalisedModuleOwner === undefined ? {} : { moduleOwner: normalisedModuleOwner }),
      ...(options.registry === undefined ? {} : { registry: options.registry }),
      fallbackCodeTeam,
    });
    const line = formatOwnedLogEntry({
      level,
      message: msg,
      fields,
      ...(err === undefined ? {} : { error: err }),
      ...ownership,
    });
    sink.write(line, level);
  };

  return {
    info: (record) => emit('info', record),
    warn: (record) => emit('warn', record),
    error: (record, err) => emit('error', record, err),
  };
}
