import { describe, expect, it } from 'bun:test';
import { defineOwnheim } from '@ownheim/core/defineOwnheim';
import type { Owner, OwnheimConfig } from '@ownheim/core/types';
import { rules } from '@ownheim/lint-core/rules/registry';
import { projectOxlintRule, type OxlintRuleContext } from './adapter.ts';

const config = defineOwnheim({
  fallback: 'Platform',
  teams: {
    Billing: { github: '@org/billing', owns: ['packages/billing/**'] },
    Platform: { github: '@org/platform' },
  },
}) as unknown as OwnheimConfig<Record<string, Owner>>;

describe('projectOxlintRule', () => {
  it('produces a valid OxlintRule shape for every registered rule', () => {
    for (const r of rules) {
      const projected = projectOxlintRule(r);
      expect(projected.meta.type).toBe(r.meta.category);
      expect(projected.meta.description).toBe(r.meta.description);
      if (r.meta.fixable) {
        expect(projected.meta.fixable).toBe('code');
      } else {
        expect(projected.meta.fixable).toBeUndefined();
      }
      expect(typeof projected.create).toBe('function');
    }
  });

  it('end-to-end Program() propagates diagnostics from validateFileOwnership', () => {
    const noOwnheim = rules.find((r) => r.meta.id === 'no-ownheim');
    expect(noOwnheim).toBeDefined();
    const projected = projectOxlintRule(noOwnheim!);

    const reports: Array<{ message: string }> = [];
    const ctx: OxlintRuleContext = {
      filename: 'tools/deploy.ts',
      sourceText: 'export const x = 1;\n',
      options: [{ config }],
      report: (r) => reports.push({ message: r.message }),
    };

    projected.create(ctx).Program();
    expect(reports).toHaveLength(1);
    expect(reports[0]?.message).toContain('fallback');
  });
});
