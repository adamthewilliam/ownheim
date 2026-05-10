import { describe, expect, it } from 'bun:test';
import { defineStrays } from './defineStrays.ts';

describe('defineStrays', () => {
  it('returns the config unchanged for valid input', () => {
    const config = defineStrays({
      teams: {
        Billing: { github: '@org/billing', owns: ['packages/billing/**'] },
      },
    });

    expect(config.teams.Billing.github).toBe('@org/billing');
    expect(config.teams.Billing.owns).toEqual(['packages/billing/**']);
  });

  it('throws when a shared rule references an unknown team', () => {
    expect(() =>
      defineStrays({
        teams: {
          Billing: { github: '@org/billing' },
        },
        // @ts-expect-error - intentional invalid team reference for runtime check
        shared: [{ glob: '**', owners: ['Platform'] }],
      }),
    ).toThrow(/unknown team 'Platform'/);
  });

  it('throws when more than one team has fallback: true', () => {
    expect(() =>
      defineStrays({
        teams: {
          Billing: { github: '@org/billing', fallback: true },
          Platform: { github: '@org/platform', fallback: true },
        },
      }),
    ).toThrow(/at most one team may have fallback: true/);
  });

  it('accepts shared rules with multiple teams', () => {
    const config = defineStrays({
      teams: {
        Billing: { github: '@org/billing' },
        Platform: { github: '@org/platform' },
      },
      shared: [{ glob: 'shared/**', owners: ['Billing', 'Platform'] }],
    });

    expect(config.shared?.[0]?.owners).toEqual(['Billing', 'Platform']);
  });

  it('rejects shared rules with an unknown team in the array', () => {
    expect(() =>
      defineStrays({
        teams: {
          Billing: { github: '@org/billing' },
        },
        // @ts-expect-error
        shared: [{ glob: 'shared/**', owners: ['Billing', 'Identity'] }],
      }),
    ).toThrow(/unknown team 'Identity'/);
  });
});
