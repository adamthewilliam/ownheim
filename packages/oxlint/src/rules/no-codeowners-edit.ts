import { runRule } from '@strays/lint-core/adapter';
import { noCodeownersEditRule as logic } from '@strays/lint-core/rules/noCodeownersEdit';
import { oxlintAdapter, type OxlintRule } from '../adapter.ts';

export const noCodeownersEditRule: OxlintRule = {
  meta: {
    type: 'problem',
    description: '.github/CODEOWNERS is generated; do not hand-edit',
  },
  create(context) {
    return {
      Program: () => runRule<typeof context, never>(oxlintAdapter, logic, context),
    };
  },
};
