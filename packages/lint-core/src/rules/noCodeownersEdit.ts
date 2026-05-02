import { validateCodeownersEdit } from '../validateCodeownersEdit.ts';
import type { LintRuleDefinition } from '../adapter.ts';

export const noCodeownersEditRule: LintRuleDefinition<never> = {
  validate: ({ filePath, sourceText }) => validateCodeownersEdit({ filePath, sourceText }),
};
