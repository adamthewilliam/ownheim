# DESIGN: Deepening the Owner-Aware Logger

> Ousterhout's "A Philosophy of Software Design": deepen modules; pull a meaningful interface above a substantial body of behavior. The two existing loggers are *shallow* duplicates — each one re-implements team-tagged JSON formatting and owned-error-chain walking, but with a different sink. We want one deep formatter and two thin wrappers.

---

## 1. Problem statement

There are two logger implementations that overlap heavily but do not share code:

| Concern | `packages/runtime/src/createLogger.ts` (~60 lines) | `packages/effect/src/Logger.ts` (~32 lines) |
|---|---|---|
| Owner resolution: chain walk | `walkOwnedErrorChain(err)` on `error()` | `walkOwnedErrorChain(extractCauseError(cause))` on every level |
| Owner resolution: scope | `currentOwner()` (AsyncLocalStorage) | `annotations.team` (Effect's `annotateLogs`) |
| Owner resolution: module | `moduleOwner` constructor arg | n/a (all annotation-based) |
| Fallback | configurable, default `'unowned'` | hardcoded `'unowned'` |
| Field shape | `{ ...record, team }` (msg field is whatever caller passed) | `{ level, msg, ...annotations, team }` |
| Level mapping | mirrors `console.info/warn/error` | one path; `logLevel.label` becomes a JSON field |
| Sink | `LogSink` port (defaults to `console.*`) | hardcoded `console.log` |
| Error serialisation | `String(err)` if present | implicit (whatever Effect put in `cause`) |

**What overlaps (the duplication that hurts):**
- Walking the owned-error-chain to extract a team
- Falling back through scope → module → `'unowned'`
- Producing a JSON line where `team` is the canonical field
- Choosing how an `unknown` error becomes a serialisable field

**What genuinely differs (the variation we must preserve):**
- **Sink**: runtime can be redirected to any `LogSink`; Effect always writes to `console.log`
- **Scope source**: runtime reads AsyncLocalStorage; Effect reads `annotations`
- **Level representation**: runtime uses three methods on the sink; Effect emits a single line tagged with `logLevel.label`
- **Cause unwrapping**: only Effect needs to peel `Cause.Fail` / `Cause.Die`

**The bug-propagation hazard:** any change to JSON shape (e.g. add `timestamp`, redact PII fields, normalise `Error → { name, message, stack }`) has to be made twice. The two implementations have already drifted — runtime emits `{...record, team}`, Effect emits `{level, msg, ...annotations, team}`. They are not interoperable today.

---

## 2. Candidate interfaces

### Candidate A — Pure formatter + sink port (recommended)

A single pure function in `@strays/runtime` produces the JSON line; both wrappers feed it inputs they already have on hand.

```ts
// @strays/runtime/formatOwnedLogEntry
export interface OwnedLogEntry {
  readonly level: 'info' | 'warn' | 'error' | 'debug' | 'trace' | 'fatal';
  readonly message: string;
  readonly fields: Readonly<Record<string, unknown>>;
  readonly error?: unknown;
  readonly scopeOwner?: string;   // resolved by caller (ALS for runtime, annotation for Effect)
  readonly moduleOwner?: string;  // runtime only
  readonly fallback?: string;     // default 'unowned'
}

export interface FormattedLogLine {
  readonly team: string;
  readonly json: string;          // serialised line ready for any sink
  readonly record: Readonly<Record<string, unknown>>; // structured form, for sinks that want it
}

export function formatOwnedLogEntry(entry: OwnedLogEntry): FormattedLogLine;
```

Sinks become a separate, tiny port:

```ts
export interface LogSink {
  write(line: FormattedLogLine, level: OwnedLogEntry['level']): void;
}
```

**Pros:** purest deep module — formatter is referentially transparent, exhaustively testable in isolation; sinks are trivial; no dependency direction issues.
**Cons:** breaks the existing `LogSink` shape (3 methods → 1); existing test sinks must migrate.

### Candidate B — `createLogger(sink)` is the canonical core; Effect wraps it

`@strays/effect/Logger.ts` becomes:

```ts
const logger = createLogger('', { sink: effectBridgeSink });
EffectLogger.make(({ logLevel, message, annotations, cause }) => {
  const err = extractCauseError(cause);
  const team = Object.fromEntries(annotations).team;
  if (logLevel.label === 'error' || logLevel.label === 'fatal') {
    logger.error({ msg: message, ...annotationsObj }, err);
  } else {
    logger[methodFor(logLevel)]({ msg: message, ...annotationsObj });
  }
});
```

**Pros:** preserves runtime's existing `LogSink` 3-method shape; smallest delta to runtime tests.
**Cons:** the canonical "thing" is still a stateful logger object — formatting is hidden inside method bodies and not directly testable; Effect wrapper has to round-trip annotations into a fake `record`.

### Candidate C — Effect-native canonical, runtime wraps it

Make the Effect logger the source of truth and have runtime depend on `effect`.

**Pros:** Effect users get full `Logger.make` ergonomics natively.
**Cons:** runtime would need to depend on `effect` (a 2 MB peer dep), inverting the current sensible direction (`@strays/effect` → `@strays/runtime`). Non-Effect consumers pay the Effect tax. Reject.

---

## 3. Recommended design — Candidate A

### 3.1 Where the formatter lives

`packages/runtime/src/formatOwnedLogEntry.ts` — a new file in `@strays/runtime`. Pure, no I/O, no async, no globals. Tested directly. No new external dependency on `@strays/effect`. The existing `walkOwnedErrorChain` and `OWNER_TAG` machinery stays put and is reused.

### 3.2 Signature

```ts
// packages/runtime/src/formatOwnedLogEntry.ts
import { walkOwnedErrorChain } from './walkOwnedErrorChain.ts';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface OwnedLogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly fields?: Readonly<Record<string, unknown>>;
  readonly error?: unknown;
  readonly scopeOwner?: string;     // caller-resolved (ALS or annotation)
  readonly moduleOwner?: string;    // optional, only the runtime wrapper sets this
  readonly fallback?: string;       // default 'unowned'
}

export interface FormattedLogLine {
  readonly team: string;
  readonly record: Readonly<Record<string, unknown>>;
  readonly json: string;
}

export function formatOwnedLogEntry(entry: OwnedLogEntry): FormattedLogLine {
  const causeOwner = entry.error !== undefined ? walkOwnedErrorChain(entry.error) : undefined;
  const team = causeOwner ?? entry.scopeOwner ?? entry.moduleOwner ?? entry.fallback ?? 'unowned';
  const record = {
    level: entry.level,
    msg: entry.message,
    ...(entry.fields ?? {}),
    ...(entry.error !== undefined ? { err: serialiseError(entry.error) } : {}),
    team,
  };
  return { team, record, json: JSON.stringify(record) };
}
```

`serialiseError` is a private helper (also in this file) that turns `Error → { name, message, stack, cause? }`, leaves primitives alone, and falls back to `String(unknown)`. This is the *single* place where PII redaction or stack trimming will live going forward.

### 3.3 The `LogSink` port

```ts
// packages/runtime/src/LogSink.ts
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

// Test-only helper, exported from the same file or co-located in test code:
export function makeMemorySink(): {
  readonly sink: LogSink;
  readonly lines: ReadonlyArray<FormattedLogLine>;
} {
  const lines: FormattedLogLine[] = [];
  return {
    sink: { write: (line) => { lines.push(line); } },
    lines,
  };
}
```

One method, two implementations, both trivial.

### 3.4 How `runtime/createLogger.ts` consumes it

```ts
// packages/runtime/src/createLogger.ts (post-refactor)
import { currentOwner } from './currentOwner.ts';
import { formatOwnedLogEntry, type LogLevel } from './formatOwnedLogEntry.ts';
import { stdoutJsonSink, type LogSink } from './LogSink.ts';

export interface Logger {
  info(record: { msg: string; [k: string]: unknown }): void;
  warn(record: { msg: string; [k: string]: unknown }): void;
  error(record: { msg: string; [k: string]: unknown }, err?: unknown): void;
}

export function createLogger(
  moduleOwner: string,
  options: { sink?: LogSink; fallback?: string } = {},
): Logger {
  const sink = options.sink ?? stdoutJsonSink;
  const fallback = options.fallback ?? 'unowned';
  const normalisedModuleOwner = moduleOwner === '' ? undefined : moduleOwner;

  const emit = (level: LogLevel, record: { msg: string; [k: string]: unknown }, err?: unknown) => {
    const { msg, ...fields } = record;
    const line = formatOwnedLogEntry({
      level,
      message: msg,
      fields,
      error: err,
      scopeOwner: currentOwner(),
      moduleOwner: normalisedModuleOwner,
      fallback,
    });
    sink.write(line, level);
  };

  return {
    info: (r) => emit('info', r),
    warn: (r) => emit('warn', r),
    error: (r, err) => emit('error', r, err),
  };
}
```

Roughly 25 lines of glue. All formatting decisions delegated.

### 3.5 How `effect/Logger.ts` consumes it

```ts
// packages/effect/src/Logger.ts (post-refactor)
import { Logger as EffectLogger } from 'effect';
import { formatOwnedLogEntry, type LogLevel } from '@strays/runtime/formatOwnedLogEntry';
import { stdoutJsonSink, type LogSink } from '@strays/runtime/LogSink';

const levelFromLabel = (label: string): LogLevel =>
  (['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const).find((l) => l === label) ?? 'info';

export const makeOwnershipLogger = (sink: LogSink = stdoutJsonSink) =>
  EffectLogger.make(({ logLevel, message, annotations, cause }) => {
    const annotationsObj = Object.fromEntries(annotations);
    const scopeOwner = typeof annotationsObj.team === 'string' ? annotationsObj.team : undefined;
    const level = levelFromLabel(logLevel.label);
    const line = formatOwnedLogEntry({
      level,
      message: typeof message === 'string' ? message : String(message),
      fields: annotationsObj,
      error: extractCauseError(cause),
      scopeOwner,
    });
    sink.write(line, level);
  });

export const ownershipLogger = makeOwnershipLogger();
export const OwnershipLoggerLayer = EffectLogger.replace(EffectLogger.defaultLogger, ownershipLogger);

function extractCauseError(cause: unknown): unknown { /* unchanged */ }
```

Roughly 20 lines. The cause-unwrapping is the only Effect-specific concern that remains.

### 3.6 Architecture diagram

```
                           +---------------------------------+
                           | formatOwnedLogEntry (pure)      |
                           |  - walks owned-error chain      |
                           |  - resolves team                |
                           |  - serialises error             |
                           |  - emits {team, record, json}   |
                           +----------------+----------------+
                                            ^
                          consumes          |          consumes
              +-----------------------------+-----------------------------+
              |                                                           |
   @strays/runtime/createLogger                          @strays/effect/Logger
   - reads AsyncLocalStorage scope                       - reads Effect annotations.team
   - injects moduleOwner                                 - unwraps Cause.Fail/Die
   - delegates to LogSink                                - delegates to LogSink
              |                                                           |
              +----------------------+------------------------------------+
                                     v
                           +---------------------+
                           |   LogSink port      |
                           |   write(line,level) |
                           +----------+----------+
                                      |
                       +--------------+---------------+
                       |                              |
              stdoutJsonSink                  makeMemorySink (tests)
```

---

## 4. Test strategy

### 4.1 Single source of truth: `formatOwnedLogEntry.test.ts`

Move all behavioural tests here. This is now the deep boundary worth testing exhaustively.

| Existing test (file)                                  | New home                            |
|-------------------------------------------------------|-------------------------------------|
| `createLogger.test.ts` "uses module owner"            | `formatOwnedLogEntry.test.ts`       |
| `createLogger.test.ts` "prefers ALS scope"            | wrapper test — see 4.2              |
| `createLogger.test.ts` "prefers OwnedError on error"  | `formatOwnedLogEntry.test.ts`       |
| `createLogger.test.ts` "falls back to scope"          | `formatOwnedLogEntry.test.ts`       |
| `createLogger.test.ts` "falls back to 'unowned'"      | `formatOwnedLogEntry.test.ts`       |
| (no existing tests in `effect/Logger.ts`)             | wrapper test — see 4.2              |

The formatter tests assert:
- precedence: cause-owner > scopeOwner > moduleOwner > fallback > `'unowned'`
- error chain walking through `cause` (already covered by `walkOwnedErrorChain.test.ts`, but also asserted end-to-end here)
- `record.team` and `json`'s `"team"` agree
- error serialisation: `Error` → `{name, message, stack}`; primitive → `String(x)`; `undefined` → omitted
- nested fields are passed through verbatim (no key collisions with `level`/`msg`/`team`/`err`)

### 4.2 Tiny per-wrapper tests (sink wiring only)

`createLogger.test.ts` shrinks to ~3 cases — it asserts only the wiring contract:
- `currentOwner()` is read and passed to `formatOwnedLogEntry` as `scopeOwner` (use `runWithOwner` + a memory sink, assert `team` matches scope)
- `moduleOwner` is forwarded
- the sink's `write` is called once per call, with the correct `level`

`effect/Logger.test.ts` (new, ~3 cases):
- `Effect.annotateLogs('team', 'Foo')` → `team` field is `'Foo'` in the captured line
- a failing Effect with an `OwnedError` → `team` matches the OwnedError owner
- `logLevel.label` round-trips into the record's `level`

### 4.3 Files that collapse / change

- **New:** `packages/runtime/src/formatOwnedLogEntry.ts` (+ `.test.ts`)
- **New:** `packages/runtime/src/LogSink.ts`
- **Shrunk:** `packages/runtime/src/createLogger.ts` (~60 → ~25 lines)
- **Shrunk:** `packages/effect/src/Logger.ts` (~32 → ~20 lines)
- **Shrunk:** `packages/runtime/src/createLogger.test.ts` (5 cases → ~3 cases)
- **New:** `packages/effect/src/Logger.test.ts` (~3 cases)
- **Updated:** `packages/runtime/package.json` `exports` adds `./formatOwnedLogEntry` and `./LogSink`
- **Note (per project rule):** no barrel exports; both wrappers import directly from `@strays/runtime/formatOwnedLogEntry` and `@strays/runtime/LogSink`

---

## 5. Trade-offs and risks

### 5.1 Dependency direction
Already correct: `@strays/effect` lists `@strays/runtime` as a workspace dependency (`packages/effect/package.json:18`) and already imports `walkOwnedErrorChain` from it (`packages/effect/src/Logger.ts:2`). Adding two more imports from `@strays/runtime` does not introduce a new edge or risk a cycle. `@strays/runtime` does *not* depend on `effect` and must not start.

### 5.2 Sink-vs-Layer tension for Effect users
Effect users typically configure logging via `Layer.provide(OwnershipLoggerLayer)`. Today that layer is hardcoded with `console.log`. Two options preserve idiomatic Effect ergonomics:

- **A (recommended):** export `makeOwnershipLogger(sink)` and `ownershipLayer(sink)` factories. Default exports keep the current `console.log` behaviour. Power users compose a custom `LogSink` (e.g. one that writes to OTel) and pass it to the layer factory. Layer composition is preserved; the sink is just an implementation detail of the layer.
- **B:** Wrap the sink itself in an Effect `Context.Tag` (`LogSink` service) so it can be swapped via `Layer.provideMerge`. More idiomatic to Effect, but couples the sink port to Effect — runtime users can't reuse the sink type. Reject for now; revisit if a real Effect consumer asks for it.

### 5.3 Field-shape drift is the actual risk we're mitigating
Today the two loggers emit *different JSON*. The unification flips one of the two shapes for at least one consumer. Mitigations:
- Pick the more uniform shape: `{ level, msg, ...fields, err?, team }`. The runtime logger gains a `level` field (additive, not breaking for consumers reading `team`/`msg`); the Effect logger keeps the same fields.
- Snapshot-test the JSON shape to lock it down before the refactor lands.
- Communicate the change in a changelog entry; the runtime sink interface (3 methods → 1) is a breaking change for any external consumer who built a custom `LogSink`.

### 5.4 Performance
`JSON.stringify` runs once inside the formatter; sinks reuse `line.json` rather than re-serialising. This is strictly faster than today's runtime path, which serialises inside each sink method, and identical to today's Effect path.

### 5.5 Things deliberately not done
- No new log levels — the formatter accepts `trace`/`debug`/`fatal` so the Effect side stops collapsing them, but no API in `Logger` exposes them yet. Add when needed.
- No structured timestamp — easy follow-up once the formatter is the chokepoint.
- No PII redaction hook — the formatter is the *place* it will go; not adding it now keeps the refactor reversible.
