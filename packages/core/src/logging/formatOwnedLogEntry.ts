export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface OwnedLogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly fields?: Readonly<Record<string, unknown>>;
  readonly error?: unknown;
  readonly entrypointTeam?: string;
  readonly codeTeam?: string;
  readonly responderTeam?: string;
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
  const entrypointTeam = entry.entrypointTeam;
  const codeTeam = entry.codeTeam;
  const responderTeam = entry.responderTeam;
  const team = responderTeam ?? entrypointTeam ?? codeTeam ?? 'unowned';
  const record: Record<string, unknown> = {
    level: entry.level,
    msg: entry.message,
    ...entry.fields,
    ...(entry.error !== undefined ? { err: serialiseError(entry.error) } : {}),
    ...(entrypointTeam === undefined ? {} : { strays_entrypoint_team: entrypointTeam }),
    ...(codeTeam === undefined ? {} : { strays_code_team: codeTeam }),
    ...(responderTeam === undefined ? {} : { strays_responder_team: responderTeam }),
    team,
  };

  return { team, record, json: JSON.stringify(record) };
}
