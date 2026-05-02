import type { LintAdapter } from '@strays/lint-core/adapter';
import type { Diagnostic } from '@strays/lint-core/types';

export interface EslintFixer {
  insertTextAfterRange(
    range: [number, number],
    text: string,
  ): { range: [number, number]; text: string };
}

export interface EslintRuleContext {
  getFilename(): string;
  getSourceCode(): { getText(): string };
  options: ReadonlyArray<unknown>;
  report(descriptor: {
    message: string;
    loc: { line: number; column: number };
    fix?: (fixer: EslintFixer) => { range: [number, number]; text: string };
  }): void;
}

export interface EslintRule {
  meta: {
    type: 'suggestion' | 'problem';
    docs: { description: string };
    fixable?: 'code';
    schema: ReadonlyArray<unknown>;
  };
  create(context: EslintRuleContext): { Program(): void };
}

export const eslintAdapter: LintAdapter<EslintRuleContext> = {
  getFilename: (ctx) => ctx.getFilename(),
  getSourceText: (ctx) => ctx.getSourceCode().getText(),
  getOptions: <T>(ctx: EslintRuleContext) => ctx.options[0] as T | undefined,
  report: (ctx, d: Diagnostic) => {
    const descriptor: Parameters<EslintRuleContext['report']>[0] = {
      message: d.message,
      loc: { line: d.line, column: d.column },
    };
    if (d.fix) {
      const fix = d.fix;
      descriptor.fix = (fixer) =>
        fixer.insertTextAfterRange([fix.insertAt, fix.insertAt], fix.insertText);
    }
    ctx.report(descriptor);
  },
};
