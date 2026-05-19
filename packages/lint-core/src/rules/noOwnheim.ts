import { validateFileOwnership } from '../validateFileOwnership.ts';
import type { LintRuleDefinition, LintRuleOptions } from '../adapter.ts';

export const noOwnheimRule: LintRuleDefinition<LintRuleOptions> = {
  validate: ({ filePath, sourceText, options }) => {
    if (!options) return [];
    return validateFileOwnership({ filePath, sourceText, config: options.config });
  },
};
