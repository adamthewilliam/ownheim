import { describe, expect, it } from 'bun:test';
import { defineStrays } from './defineStrays.ts';

describe('defineStrays', () => {
  it('returns the config unchanged for valid input', () => {
    const config = defineStrays({
      owners: {
        Billing: { id: 'Billing', github: '@org/billing' },
      },
      rules: [{ glob: 'packages/billing/**', owner: 'Billing' }],
    });

    expect(config.owners.Billing.github).toBe('@org/billing');
    expect(config.rules).toHaveLength(1);
  });

  it('throws when a rule references an unknown owner', () => {
    expect(() =>
      defineStrays({
        owners: {
          Billing: { id: 'Billing', github: '@org/billing' },
        },
        // @ts-expect-error - intentional invalid owner reference for runtime check
        rules: [{ glob: '**', owner: 'Platform' }],
      }),
    ).toThrow(/unknown owner 'Platform'/);
  });

  it('throws when more than one rule has fallback: true', () => {
    expect(() =>
      defineStrays({
        owners: {
          Billing: { id: 'Billing', github: '@org/billing' },
        },
        rules: [
          { glob: '**/*.ts', owner: 'Billing', fallback: true },
          { glob: '**', owner: 'Billing', fallback: true },
        ],
      }),
    ).toThrow(/at most one rule may have fallback: true/);
  });

  it('accepts arrays of owners for multi-team rules', () => {
    const config = defineStrays({
      owners: {
        Billing: { id: 'Billing', github: '@org/billing' },
        Platform: { id: 'Platform', github: '@org/platform' },
      },
      rules: [{ glob: 'shared/**', owner: ['Billing', 'Platform'] }],
    });

    expect(config.rules[0]?.owner).toEqual(['Billing', 'Platform']);
  });

  it('rejects multi-team rules with an unknown owner in the array', () => {
    expect(() =>
      defineStrays({
        owners: {
          Billing: { id: 'Billing', github: '@org/billing' },
        },
        // @ts-expect-error
        rules: [{ glob: 'shared/**', owner: ['Billing', 'Identity'] }],
      }),
    ).toThrow(/unknown owner 'Identity'/);
  });
});
