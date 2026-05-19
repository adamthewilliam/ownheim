import { describe, expect, it } from 'bun:test';
import { defineOwnheim } from '@ownheim/core/defineOwnheim';
import type { Team, OwnheimConfig } from '@ownheim/core/types';
import { rules } from '@ownheim/lint-core/rules/registry';
import { plugin as eslintPlugin } from './plugin.ts';
import type { EslintRuleContext } from './adapter.ts';

const config = defineOwnheim({
  teams: {
    Billing: { github: '@org/billing', owns: ['packages/billing/**'] },
    Platform: { github: '@org/platform', fallback: true },
  },
}) as unknown as OwnheimConfig<Record<string, Team>>;

describe('eslint plugin', () => {
  it('plugin.rules keys equal registry ids', () => {
    expect(Object.keys(eslintPlugin.rules).sort()).toEqual(
      rules.map((r) => r.meta.id).sort(),
    );
  });

  it('no-ownheim smoke-test fires for fallback-only files', () => {
    const reports: Array<{ message: string }> = [];
    const ctx: EslintRuleContext = {
      getFilename: () => 'tools/deploy.ts',
      getSourceCode: () => ({ getText: () => 'export const x = 1;\n' }),
      options: [{ config }],
      report: (r) => reports.push({ message: r.message }),
    };

    eslintPlugin.rules['no-ownheim']!.create(ctx).Program();
    expect(reports).toHaveLength(1);
    expect(reports[0]?.message).toContain('fallback');
  });
});
