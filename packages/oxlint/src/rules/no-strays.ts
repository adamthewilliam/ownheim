import { runRule, type LintRuleOptions } from '@strays/lint-core/adapter';
import { noStraysRule as logic } from '@strays/lint-core/rules/noStrays';
import { oxlintAdapter } from '../adapter.ts';

export type { OxlintRule, OxlintRuleContext } from '../adapter.ts';
import type { OxlintRule } from '../adapter.ts';

export const noStraysRule: OxlintRule = {
  meta: {
    type: 'problem',
    description: 'every source file must resolve to an explicit (non-fallback) owner',
    fixable: 'code',
  },
  create(context) {
    return {
      Program: () => runRule<typeof context, LintRuleOptions>(oxlintAdapter, logic, context),
    };
  },
};
