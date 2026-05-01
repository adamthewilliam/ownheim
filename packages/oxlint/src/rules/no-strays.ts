import { validateFileOwnership } from '@strays/lint-core/validateFileOwnership';
import type { Owner, StraysConfig } from '@strays/core/types';

export interface OxlintRuleContext {
  filename: string;
  sourceText: string;
  options: ReadonlyArray<{ config: StraysConfig<Record<string, Owner>> }>;
  report(diagnostic: {
    message: string;
    loc: { line: number; column: number };
    fix?: { range: [number, number]; text: string };
  }): void;
}

export interface OxlintRule {
  meta: {
    type: 'suggestion' | 'problem';
    description: string;
    fixable?: 'code';
  };
  create(context: OxlintRuleContext): { Program(): void };
}

export const noStraysRule: OxlintRule = {
  meta: {
    type: 'problem',
    description: 'every source file must resolve to an explicit (non-fallback) owner',
    fixable: 'code',
  },
  create(context) {
    return {
      Program() {
        const config = context.options[0]?.config;
        if (!config) return;

        const diagnostics = validateFileOwnership({
          filePath: context.filename,
          sourceText: context.sourceText,
          config,
        });

        for (const d of diagnostics) {
          const report: Parameters<OxlintRuleContext['report']>[0] = {
            message: d.message,
            loc: { line: d.line, column: d.column },
          };
          if (d.fix) {
            report.fix = { range: [d.fix.insertAt, d.fix.insertAt], text: d.fix.insertText };
          }
          context.report(report);
        }
      },
    };
  },
};
