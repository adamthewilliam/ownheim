import type { FormattedLogLine, LogLevel } from './formatOwnedLogEntry.ts';

export interface LogSink {
  write(line: FormattedLogLine, level: LogLevel): void;
}

export const stdoutJsonSink: LogSink = {
  write: (line, level) => {
    if (level === 'error' || level === 'fatal') console.error(line.json);
    else if (level === 'warn') console.warn(line.json);
    else console.info(line.json);
  },
};

export interface MemorySink {
  readonly sink: LogSink;
  readonly lines: ReadonlyArray<FormattedLogLine>;
}

export function makeMemorySink(): MemorySink {
  const lines: FormattedLogLine[] = [];
  const sink: LogSink = {
    write: (line) => {
      lines.push(line);
    },
  };
  return { sink, lines };
}
