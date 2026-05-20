import { describe, expect, it } from 'bun:test';
import { defineOwnheim } from '@ownheim/core/defineOwnheim';
import type { Owner, OwnheimConfig } from '@ownheim/core/types';
import { rules } from '@ownheim/lint-core/rules/registry';
import { plugin as oxlintPlugin } from '../src/plugin.ts';
import type { OxlintRuleContext } from '../src/adapter.ts';

const config = defineOwnheim({
  fallback: 'Platform',
  teams: {
    Billing: { github: '@org/billing', owns: ['packages/billing/**'] },
    Platform: { github: '@org/platform' },
  },
}) as unknown as OwnheimConfig<Record<string, Owner>>;

describe('oxlint plugin', () => {
  it('plugin.rules keys equal registry ids', () => {
    expect(Object.keys(oxlintPlugin.rules).sort()).toEqual(
      rules.map((r) => r.meta.id).sort(),
    );
  });

  it('no-ownheim smoke-test fires for fallback-only files', () => {
    const reports: Array<{ message: string }> = [];
    const ctx: OxlintRuleContext = {
      filename: 'tools/deploy.ts',
      sourceText: 'export const x = 1;\n',
      options: [{ config }],
      report: (r) => reports.push({ message: r.message }),
    };

    oxlintPlugin.rules['no-ownheim']!.create(ctx).Program();
    expect(reports).toHaveLength(1);
    expect(reports[0]?.message).toContain('fallback');
  });
});
