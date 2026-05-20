import { describe, expect, it } from 'bun:test';
import { Effect, Logger as EffectLogger } from 'effect';
import { withOwnershipLogAnnotations } from './Logging.ts';

describe('ownership log annotation helpers', () => {
  it('adds Ownheim tags to Effect log annotations without replacing the logger', async () => {
    const annotations: Record<string, unknown>[] = [];
    const logger = EffectLogger.make(({ annotations: logAnnotations }) => {
      annotations.push(Object.fromEntries(logAnnotations));
    });

    await Effect.runPromise(
      Effect.logInfo('hello').pipe(
        withOwnershipLogAnnotations({ moduleOwner: 'Billing' }),
        Effect.provide(EffectLogger.replace(EffectLogger.defaultLogger, logger)),
      ),
    );

    expect(annotations).toHaveLength(1);
    expect(annotations[0]?.['ownheim.code_team']).toBe('Billing');
  });
});
