import { describe, expect, it } from 'bun:test';
import { defineOwnheim } from '@ownheim/core/defineOwnheim';
import { resolveOwnerForFile } from './resolveRules.ts';

const config = defineOwnheim({
  fallback: 'Platform',
  teams: {
    Billing: { github: '@org/billing', owns: ['packages/billing/**'] },
    Identity: { github: '@org/identity', owns: ['packages/auth/**'] },
    Platform: {
      github: '@org/platform',
      owns: ['packages/billing/admin/**'],
    },
  },
});

describe('resolveOwnerForFile', () => {
  it('JSDoc owner overrides any rule', () => {
    const result = resolveOwnerForFile(config, {
      filePath: 'packages/billing/charge.ts',
      jsdocOwner: 'Identity',
    });
    expect(result?.teams).toEqual(['Identity']);
    expect(result?.source).toBe('jsdoc');
  });

  it('returns undefined when JSDoc references an unknown team', () => {
    const result = resolveOwnerForFile(config, {
      filePath: 'packages/billing/charge.ts',
      jsdocOwner: 'Nonexistent',
    });
    expect(result).toBeUndefined();
  });

  it('most-specific glob wins over a less-specific match', () => {
    const result = resolveOwnerForFile(config, {
      filePath: 'packages/billing/admin/refund.ts',
    });
    expect(result?.teams).toEqual(['Platform']);
    expect(result?.matchedGlob).toBe('packages/billing/admin/**');
    expect(result?.source).toBe('rule');
  });

  it('matches a single rule when no overlap', () => {
    const result = resolveOwnerForFile(config, {
      filePath: 'packages/auth/session.ts',
    });
    expect(result?.teams).toEqual(['Identity']);
    expect(result?.source).toBe('rule');
  });

  it('falls back when no rule matches', () => {
    const result = resolveOwnerForFile(config, {
      filePath: 'tools/deploy.ts',
    });
    expect(result?.source).toBe('fallback');
    expect(result?.teams).toEqual(['Platform']);
  });

  it('returns undefined when no fallback and no match', () => {
    const cfg = defineOwnheim({
      teams: {
        Billing: { github: '@org/billing', owns: ['packages/billing/**'] },
      },
    });
    expect(resolveOwnerForFile(cfg, { filePath: 'tools/deploy.ts' })).toBeUndefined();
  });

  it('shared rule returns all teams', () => {
    const cfg = defineOwnheim({
      teams: {
        Billing: { github: '@org/billing' },
        Platform: { github: '@org/platform' },
      },
      shared: [{ glob: 'shared/**', owners: ['Billing', 'Platform'] }],
    });

    const result = resolveOwnerForFile(cfg, { filePath: 'shared/util.ts' });
    expect(result?.teams).toEqual(['Billing', 'Platform']);
  });
});
