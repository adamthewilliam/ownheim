import type { LintAdapter } from '@strays/lint-core/adapter';
import type { Diagnostic } from '@strays/lint-core/types';

export interface OxlintRuleContext {
  filename: string;
  sourceText: string;
  options: ReadonlyArray<unknown>;
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

export const oxlintAdapter: LintAdapter<OxlintRuleContext> = {
  getFilename: (ctx) => ctx.filename,
  getSourceText: (ctx) => ctx.sourceText,
  getOptions: <T>(ctx: OxlintRuleContext) => ctx.options[0] as T | undefined,
  report: (ctx, d: Diagnostic) => {
    const report: Parameters<OxlintRuleContext['report']>[0] = {
      message: d.message,
      loc: { line: d.line, column: d.column },
    };
    if (d.fix) {
      report.fix = { range: [d.fix.insertAt, d.fix.insertAt], text: d.fix.insertText };
    }
    ctx.report(report);
  },
};
