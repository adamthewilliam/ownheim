import { currentEntrypointOwner } from '@ownheim/core/ownership';
import { formatOwnedLogEntry, type FormattedLogLine, type LogLevel } from '@ownheim/core/logging/formatOwnedLogEntry';
import { walkResponderTeamChain } from '@ownheim/core/resolution/walkOwnedErrorChain';

export interface CapturedLogEntry {
  readonly level: LogLevel;
  readonly line: FormattedLogLine;
}

export interface CapturedLogs {
  readonly entries: readonly CapturedLogEntry[];
  readonly clear: () => void;
  readonly restore: () => void;
}

export interface TestLogger {
  readonly info: (fields: Readonly<Record<string, unknown>>) => void;
  readonly warn: (fields: Readonly<Record<string, unknown>>) => void;
  readonly error: (fields: Readonly<Record<string, unknown>>, error?: unknown) => void;
}

export function createCapturedLogger(capture: CapturedLogs): TestLogger {
  const write = (level: LogLevel, fields: Readonly<Record<string, unknown>>, error?: unknown) => {
    const message = typeof fields.msg === 'string' ? fields.msg : '';
    const responderTeam = walkResponderTeamChain(error);
    const entrypointTeam = currentEntrypointOwner();
    const line = formatOwnedLogEntry({
      level,
      message,
      fields,
      error,
      ...(entrypointTeam === undefined ? {} : { entrypointTeam }),
      ...(responderTeam === undefined ? {} : { responderTeam }),
    });
    (capture.entries as CapturedLogEntry[]).push({ level, line });
  };
  return {
    info: (fields) => write('info', fields),
    warn: (fields) => write('warn', fields),
    error: (fields, error) => write('error', fields, error),
  };
}

export function captureStructuredLogs(): CapturedLogs {
  const buffer: CapturedLogEntry[] = [];
  return {
    get entries(): readonly CapturedLogEntry[] {
      return buffer;
    },
    clear: () => {
      buffer.length = 0;
    },
    restore: () => {
      buffer.length = 0;
    },
  };
}
