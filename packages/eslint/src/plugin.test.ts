import { describe, expect, it } from 'bun:test';
import { defineStrays } from '@strays/core/defineStrays';
import type { Owner, StraysConfig } from '@strays/core/types';
import { rules } from '@strays/lint-core/rules/registry';
import { plugin as eslintPlugin } from './plugin.ts';
import type { EslintRuleContext } from './adapter.ts';

const config = defineStrays({
  owners: {
    Billing: { id: 'Billing', github: '@org/billing' },
    Platform: { id: 'Platform', github: '@org/platform' },
  },
  rules: [
    { glob: 'packages/billing/**', owner: 'Billing' },
    { glob: '**', owner: 'Platform', fallback: true },
  ],
}) as unknown as StraysConfig<Record<string, Owner>>;

describe('eslint plugin', () => {
  it('plugin.rules keys equal registry ids', () => {
    expect(Object.keys(eslintPlugin.rules).sort()).toEqual(
      rules.map((r) => r.meta.id).sort(),
    );
  });

  it('no-strays smoke-test fires for fallback-only files', () => {
    const reports: Array<{ message: string }> = [];
    const ctx: EslintRuleContext = {
      getFilename: () => 'tools/deploy.ts',
      getSourceCode: () => ({ getText: () => 'export const x = 1;\n' }),
      options: [{ config }],
      report: (r) => reports.push({ message: r.message }),
    };

    eslintPlugin.rules['no-strays']!.create(ctx).Program();
    expect(reports).toHaveLength(1);
    expect(reports[0]?.message).toContain('fallback');
  });
});
