import { runRule } from '@strays/lint-core/adapter';
import { noCodeownersEditRule as logic } from '@strays/lint-core/rules/noCodeownersEdit';
import { eslintAdapter, type EslintRule } from '../adapter.ts';

export const noCodeownersEditRule: EslintRule = {
  meta: {
    type: 'problem',
    docs: { description: '.github/CODEOWNERS is generated; do not hand-edit' },
    schema: [],
  },
  create(context) {
    return {
      Program: () => runRule<typeof context, never>(eslintAdapter, logic, context),
    };
  },
};
