import { describe, expect, it } from 'bun:test';
import { defineStrays } from '@strays/core/defineStrays';
import { validateFileOwnership } from '@strays/lint-core/validateFileOwnership';
import { plugin as eslintPlugin } from './plugin.ts';
import type { EslintRuleContext } from './rules/no-strays.ts';

const config = defineStrays({
  owners: {
    Billing: { id: 'Billing', github: '@org/billing' },
    Platform: { id: 'Platform', github: '@org/platform' },
  },
  rules: [
    { glob: 'packages/billing/**', owner: 'Billing' },
    { glob: '**', owner: 'Platform', fallback: true },
  ],
}) as unknown as Parameters<typeof validateFileOwnership>[0]['config'];

const fixtures = [
  { filename: 'tools/deploy.ts', sourceText: 'export const x = 1;\n', expectedDiagnostics: 1 },
  {
    filename: 'packages/billing/charge.ts',
    sourceText: 'export const x = 1;\n',
    expectedDiagnostics: 0,
  },
  {
    filename: 'tools/deploy.ts',
    sourceText: '/** @owner Billing */\nexport const x = 1;\n',
    expectedDiagnostics: 0,
  },
];

describe('eslint plugin', () => {
  it('exposes both rules', () => {
    expect(eslintPlugin.rules['no-strays']).toBeDefined();
    expect(eslintPlugin.rules['no-codeowners-edit']).toBeDefined();
  });

  it('produces the same N diagnostics as the lint-core for each fixture', () => {
    for (const fx of fixtures) {
      const expected = validateFileOwnership({
        filePath: fx.filename,
        sourceText: fx.sourceText,
        config,
      });

      const reports: Array<{ message: string }> = [];
      const ctx: EslintRuleContext = {
        getFilename: () => fx.filename,
        getSourceCode: () => ({ getText: () => fx.sourceText }),
        options: [{ config }],
        report: (r) => reports.push({ message: r.message }),
      };

      eslintPlugin.rules['no-strays'].create(ctx).Program();

      expect(reports).toHaveLength(expected.length);
      expect(reports).toHaveLength(fx.expectedDiagnostics);
    }
  });
});
