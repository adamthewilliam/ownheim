import { walkOwnedErrorChain } from '../resolution/walkOwnedErrorChain.ts';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface OwnedLogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly fields?: Readonly<Record<string, unknown>>;
  readonly error?: unknown;
  readonly scopeOwner?: string;
  readonly moduleOwner?: string;
  readonly fallback?: string;
}

export interface FormattedLogLine {
  readonly team: string;
  readonly record: Readonly<Record<string, unknown>>;
  readonly json: string;
}

interface SerialisedError {
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
  readonly cause?: unknown;
}

function serialiseError(value: unknown): unknown {
  if (value === undefined || value === null) return value;
  if (value instanceof Error) {
    const out: SerialisedError = {
      name: value.name,
      message: value.message,
      ...(value.stack === undefined ? {} : { stack: value.stack }),
      ...(value.cause === undefined ? {} : { cause: serialiseError(value.cause) }),
    };
    return out;
  }
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean' || t === 'bigint') return value;
  if (t === 'object') return value;
  return String(value);
}

export function formatOwnedLogEntry(entry: OwnedLogEntry): FormattedLogLine {
  const causeOwner = entry.error !== undefined ? walkOwnedErrorChain(entry.error) : undefined;
  // Owner-side identifier crosses the input/output boundary here: the resolved
  // OwnerId is emitted as the `team` field per observability-vendor convention.
  const team =
    causeOwner ?? entry.scopeOwner ?? entry.moduleOwner ?? entry.fallback ?? 'unowned';

  const record: Record<string, unknown> = {
    level: entry.level,
    msg: entry.message,
    ...entry.fields,
    ...(entry.error !== undefined ? { err: serialiseError(entry.error) } : {}),
    team,
  };

  return { team, record, json: JSON.stringify(record) };
}
