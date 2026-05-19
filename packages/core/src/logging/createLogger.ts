import { getDefaultLogSink } from './defaultLogSink.ts';
import { formatOwnedLogEntry, type LogLevel } from './formatOwnedLogEntry.ts';
import type { LogSink } from './LogSink.ts';
import type { ManifestRegistry } from '../manifest/ManifestRegistry.ts';
import { currentEntrypointOwner, type OwnershipContext } from '../ownership.ts';
import { walkResponderTeamChain } from '../resolution/walkOwnedErrorChain.ts';
import { resolveProjectedOwnershipContext } from '../tracing/projectOwnership.ts';

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
  const fallbackCodeTeam = options.fallbackCodeTeam ?? 'unowned';
  const normalisedModuleOwner = moduleOwner === '' ? undefined : moduleOwner;

  const emit = (level: LogLevel, record: LogRecord, err?: unknown) => {
    const { msg, ...fields } = record;
    const ownership =
      normalisedModuleOwner === undefined
        ? resolveProjectedOwnershipContext({
            ...(err === undefined ? {} : { error: err }),
            ...(options.registry === undefined ? {} : { registry: options.registry }),
            fallbackCodeTeam,
          })
        : resolveKnownModuleOwnership(normalisedModuleOwner, err);
    const line = formatOwnedLogEntry({
      level,
      message: msg,
      fields,
      ...(err === undefined ? {} : { error: err }),
      ...ownership,
    });
    (options.sink ?? getDefaultLogSink()).write(line, level);
  };

  return {
    info: (record) => emit('info', record),
    warn: (record) => emit('warn', record),
    error: (record, err) => emit('error', record, err),
  };
}

function resolveKnownModuleOwnership(moduleOwner: string, err: unknown): OwnershipContext {
  const entrypointTeam = currentEntrypointOwner();
  const responderTeam = err === undefined ? undefined : walkResponderTeamChain(err);
  return {
    ...(entrypointTeam === undefined ? {} : { entrypointTeam }),
    codeTeam: moduleOwner,
    ...(responderTeam === undefined ? {} : { responderTeam }),
  };
}
