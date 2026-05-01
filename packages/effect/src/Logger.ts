import { Logger as EffectLogger } from 'effect';
import { walkOwnedErrorChain } from '@strays/runtime/walkOwnedErrorChain';

export const ownershipLogger = EffectLogger.make(
  ({ logLevel, message, annotations, cause }) => {
    const causeOwner = walkOwnedErrorChain(extractCauseError(cause));
    const annotationsObj = Object.fromEntries(annotations);
    const annotationTeam = typeof annotationsObj.team === 'string' ? annotationsObj.team : undefined;
    const team = causeOwner ?? annotationTeam ?? 'unowned';

    console.log(
      JSON.stringify({
        level: logLevel.label,
        msg: message,
        ...annotationsObj,
        team,
      }),
    );
  },
);

export const OwnershipLoggerLayer = EffectLogger.replace(EffectLogger.defaultLogger, ownershipLogger);

function extractCauseError(cause: unknown): unknown {
  if (cause === null || cause === undefined) return undefined;
  if (typeof cause !== 'object') return undefined;

  const c = cause as { _tag?: string; error?: unknown; defect?: unknown };
  if (c._tag === 'Fail') return c.error;
  if (c._tag === 'Die') return c.defect;
  return undefined;
}
