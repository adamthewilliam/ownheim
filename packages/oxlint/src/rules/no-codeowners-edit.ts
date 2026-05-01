import { validateCodeownersEdit } from '@strays/lint-core/validateCodeownersEdit';
import type { OxlintRule, OxlintRuleContext } from './no-strays.ts';

export const noCodeownersEditRule: OxlintRule = {
  meta: {
    type: 'problem',
    description: '.github/CODEOWNERS is generated; do not hand-edit',
  },
  create(context: OxlintRuleContext) {
    return {
      Program() {
        const diagnostics = validateCodeownersEdit({
          filePath: context.filename,
          sourceText: context.sourceText,
        });

        for (const d of diagnostics) {
          context.report({ message: d.message, loc: { line: d.line, column: d.column } });
        }
      },
    };
  },
};
