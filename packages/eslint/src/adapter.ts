import { runRule, type LintAdapter } from '@ownheim/lint-core/adapter';
import type { Diagnostic } from '@ownheim/lint-core/types';
import type { RegisteredRule, RuleMeta } from '@ownheim/lint-core/rules/registry';

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

export const schemaFor = (optionsSchema: RuleMeta['optionsSchema']): ReadonlyArray<unknown> => {
  if (optionsSchema === 'lint-rule-options') {
    return [
      {
        type: 'object',
        properties: { config: { type: 'object' } },
        required: ['config'],
        additionalProperties: false,
      },
    ];
  }
  return [];
};

export const projectEslintRule = (r: RegisteredRule<unknown>): EslintRule => ({
  meta: {
    type: r.meta.category,
    docs: { description: r.meta.description },
    ...(r.meta.fixable ? { fixable: 'code' as const } : {}),
    schema: schemaFor(r.meta.optionsSchema),
  },
  create: (ctx) => ({
    Program: () => runRule(eslintAdapter, r.definition, ctx),
  }),
});
