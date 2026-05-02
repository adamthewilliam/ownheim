import { runRule, type LintRuleOptions } from '@strays/lint-core/adapter';
import { noStraysRule as logic } from '@strays/lint-core/rules/noStrays';
import { eslintAdapter } from '../adapter.ts';

export type { EslintFixer, EslintRule, EslintRuleContext } from '../adapter.ts';
import type { EslintRule } from '../adapter.ts';

export const noStraysRule: EslintRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'every source file must resolve to an explicit (non-fallback) owner',
    },
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
      Program: () => runRule<typeof context, LintRuleOptions>(eslintAdapter, logic, context),
    };
  },
};
