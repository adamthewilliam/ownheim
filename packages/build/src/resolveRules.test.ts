import { describe, expect, it } from 'bun:test';
import { defineStrays } from '@strays/core/defineStrays';
import { resolveOwnerForFile } from './resolveRules.ts';

const config = defineStrays({
  owners: {
    Billing: { id: 'Billing', github: '@org/billing' },
    Identity: { id: 'Identity', github: '@org/identity' },
    Platform: { id: 'Platform', github: '@org/platform' },
  },
  rules: [
    { glob: 'packages/billing/**', owner: 'Billing' },
    { glob: 'packages/auth/**', owner: 'Identity' },
    { glob: 'packages/billing/admin/**', owner: 'Platform' },
    { glob: '**', owner: 'Platform', fallback: true },
  ],
});

describe('resolveOwnerForFile', () => {
  it('JSDoc owner overrides any rule', () => {
    const result = resolveOwnerForFile(config, {
      filePath: 'packages/billing/charge.ts',
      jsdocOwner: 'Identity',
    });
    expect(result?.owners).toEqual(['Identity']);
    expect(result?.source).toBe('jsdoc');
  });

  it('returns undefined when JSDoc references an unknown owner', () => {
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
    expect(result?.owners).toEqual(['Platform']);
    expect(result?.matchedGlob).toBe('packages/billing/admin/**');
    expect(result?.source).toBe('rule');
  });

  it('matches a single rule when no overlap', () => {
    const result = resolveOwnerForFile(config, {
      filePath: 'packages/auth/session.ts',
    });
    expect(result?.owners).toEqual(['Identity']);
    expect(result?.source).toBe('rule');
  });

  it('falls back when no rule matches', () => {
    const result = resolveOwnerForFile(config, {
      filePath: 'tools/deploy.ts',
    });
    expect(result?.source).toBe('fallback');
    expect(result?.owners).toEqual(['Platform']);
  });

  it('returns undefined when no fallback and no match', () => {
    const cfg = defineStrays({
      owners: {
        Billing: { id: 'Billing', github: '@org/billing' },
      },
      rules: [{ glob: 'packages/billing/**', owner: 'Billing' }],
    });
    expect(resolveOwnerForFile(cfg, { filePath: 'tools/deploy.ts' })).toBeUndefined();
  });

  it('multi-team rule returns all owners', () => {
    const cfg = defineStrays({
      owners: {
        Billing: { id: 'Billing', github: '@org/billing' },
        Platform: { id: 'Platform', github: '@org/platform' },
      },
      rules: [{ glob: 'shared/**', owner: ['Billing', 'Platform'] }],
    });

    const result = resolveOwnerForFile(cfg, { filePath: 'shared/util.ts' });
    expect(result?.owners).toEqual(['Billing', 'Platform']);
  });
});
