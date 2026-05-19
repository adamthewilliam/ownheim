import { describe, expect, it } from 'bun:test';
import { defineOwnheim } from './defineOwnheim.ts';

describe('defineOwnheim', () => {
  it('returns the config unchanged for valid input', () => {
    const config = defineOwnheim({
      teams: {
        Billing: { github: '@org/billing', owns: ['packages/billing/**'] },
      },
    });

    expect(config.teams.Billing.github).toBe('@org/billing');
    expect(config.teams.Billing.owns).toEqual(['packages/billing/**']);
  });

  it('throws when a shared rule references an unknown team', () => {
    expect(() =>
      defineOwnheim({
        teams: {
          Billing: { github: '@org/billing' },
        },
        // @ts-expect-error - intentional invalid team reference for runtime check
        shared: [{ glob: '**', owners: ['Platform'] }],
      }),
    ).toThrow(/unknown team 'Platform'/);
  });

  it('throws when fallback references an unknown team', () => {
    expect(() =>
      defineOwnheim({
        teams: {
          Billing: { github: '@org/billing' },
        },
        // @ts-expect-error - intentional invalid team reference for runtime check
        fallback: 'Platform',
      }),
    ).toThrow(/fallback references unknown team 'Platform'/);
  });

  it('accepts shared rules with multiple teams', () => {
    const config = defineOwnheim({
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
      defineOwnheim({
        teams: {
          Billing: { github: '@org/billing' },
        },
        // @ts-expect-error
        shared: [{ glob: 'shared/**', owners: ['Billing', 'Identity'] }],
      }),
    ).toThrow(/unknown team 'Identity'/);
  });
});
