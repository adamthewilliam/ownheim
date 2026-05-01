import { currentOwner } from './currentOwner.ts';
import { walkOwnedErrorChain } from './walkOwnedErrorChain.ts';

export interface LogRecord {
  readonly msg: string;
  readonly [key: string]: unknown;
}

export interface LogSink {
  info(record: LogRecord & { team: string }): void;
  warn(record: LogRecord & { team: string }): void;
  error(record: LogRecord & { team: string; err?: unknown }): void;
}

export interface Logger {
  info(record: LogRecord): void;
  warn(record: LogRecord): void;
  error(record: LogRecord, err?: unknown): void;
}

export interface CreateLoggerOptions {
  readonly sink?: LogSink;
  readonly fallback?: string;
}

const consoleSink: LogSink = {
  info: (record) => console.info(JSON.stringify(record)),
  warn: (record) => console.warn(JSON.stringify(record)),
  error: (record) => console.error(JSON.stringify(record)),
};

export function createLogger(moduleOwner: string, options: CreateLoggerOptions = {}): Logger {
  const sink = options.sink ?? consoleSink;
  const fallback = options.fallback ?? 'unowned';
  const normalisedOwner = moduleOwner === '' ? undefined : moduleOwner;
  const resolveTeam = () => currentOwner() ?? normalisedOwner ?? fallback;

  return {
    info(record) {
      sink.info({ ...record, team: resolveTeam() });
    },
    warn(record) {
      sink.warn({ ...record, team: resolveTeam() });
    },
    error(record, err) {
      const team = walkOwnedErrorChain(err) ?? resolveTeam();
      sink.error({ ...record, team, ...(err === undefined ? {} : { err }) });
    },
  };
}
