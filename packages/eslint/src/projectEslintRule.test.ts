import { describe, expect, it } from 'bun:test';
import { defineOwnheim } from '@ownheim/core/defineOwnheim';
import type { Team, OwnheimConfig } from '@ownheim/core/types';
import { rules } from '@ownheim/lint-core/rules/registry';
import { projectEslintRule, schemaFor, type EslintRuleContext } from './adapter.ts';

const config = defineOwnheim({
  teams: {
    Billing: { github: '@org/billing', owns: ['packages/billing/**'] },
    Platform: { github: '@org/platform', fallback: true },
  },
}) as unknown as OwnheimConfig<Record<string, Team>>;

describe('projectEslintRule', () => {
  it('produces a valid EslintRule shape for every registered rule', () => {
    for (const r of rules) {
      const projected = projectEslintRule(r);
      expect(projected.meta.type).toBe(r.meta.category);
      expect(projected.meta.docs.description).toBe(r.meta.description);
      if (r.meta.fixable) {
        expect(projected.meta.fixable).toBe('code');
      } else {
        expect(projected.meta.fixable).toBeUndefined();
      }
      expect(Array.isArray(projected.meta.schema)).toBe(true);
      expect(typeof projected.create).toBe('function');
    }
  });

  it('schemaFor maps lint-rule-options to the standard config object schema', () => {
    expect(schemaFor('lint-rule-options')).toEqual([
      {
        type: 'object',
        properties: { config: { type: 'object' } },
        required: ['config'],
        additionalProperties: false,
      },
    ]);
  });

  it('schemaFor maps null to an empty array', () => {
    expect(schemaFor(null)).toEqual([]);
  });

  it('end-to-end Program() propagates diagnostics from validateFileOwnership', () => {
    const noOwnheim = rules.find((r) => r.meta.id === 'no-ownheim');
    expect(noOwnheim).toBeDefined();
    const projected = projectEslintRule(noOwnheim!);

    const reports: Array<{ message: string }> = [];
    const ctx: EslintRuleContext = {
      getFilename: () => 'tools/deploy.ts',
      getSourceCode: () => ({ getText: () => 'export const x = 1;\n' }),
      options: [{ config }],
      report: (r) => reports.push({ message: r.message }),
    };

    projected.create(ctx).Program();
    expect(reports).toHaveLength(1);
    expect(reports[0]?.message).toContain('fallback');
  });
});
