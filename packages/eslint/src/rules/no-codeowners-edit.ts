import { validateCodeownersEdit } from '@strays/lint-core/validateCodeownersEdit';
import type { EslintRule, EslintRuleContext } from './no-strays.ts';

export const noCodeownersEditRule: EslintRule = {
  meta: {
    type: 'problem',
    docs: { description: '.github/CODEOWNERS is generated; do not hand-edit' },
    schema: [],
  },
  create(context: EslintRuleContext) {
    return {
      Program() {
        const diagnostics = validateCodeownersEdit({
          filePath: context.getFilename(),
          sourceText: context.getSourceCode().getText(),
        });

        for (const d of diagnostics) {
          context.report({ message: d.message, loc: { line: d.line, column: d.column } });
        }
      },
    };
  },
};
