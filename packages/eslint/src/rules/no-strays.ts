import { validateFileOwnership } from '@strays/lint-core/validateFileOwnership';
import type { Owner, StraysConfig } from '@strays/core/types';

export interface EslintFixer {
  insertTextAfterRange(range: [number, number], text: string): { range: [number, number]; text: string };
}

export interface EslintRuleContext {
  getFilename(): string;
  getSourceCode(): { getText(): string };
  options: ReadonlyArray<{ config: StraysConfig<Record<string, Owner>> }>;
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

export const noStraysRule: EslintRule = {
  meta: {
    type: 'problem',
    docs: { description: 'every source file must resolve to an explicit (non-fallback) owner' },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: { config: { type: 'object' } },
        required: ['config'],
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    return {
      Program() {
        const config = context.options[0]?.config;
        if (!config) return;

        const diagnostics = validateFileOwnership({
          filePath: context.getFilename(),
          sourceText: context.getSourceCode().getText(),
          config,
        });

        for (const d of diagnostics) {
          const descriptor: Parameters<EslintRuleContext['report']>[0] = {
            message: d.message,
            loc: { line: d.line, column: d.column },
          };
          if (d.fix) {
            const fixSuggestion = d.fix;
            descriptor.fix = (fixer) =>
              fixer.insertTextAfterRange(
                [fixSuggestion.insertAt, fixSuggestion.insertAt],
                fixSuggestion.insertText,
              );
          }
          context.report(descriptor);
        }
      },
    };
  },
};
