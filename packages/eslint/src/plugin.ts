import { noStraysRule } from './rules/no-strays.ts';
import { noCodeownersEditRule } from './rules/no-codeowners-edit.ts';

export const plugin = {
  meta: { name: '@strays/eslint', version: '0.1.0' },
  rules: {
    'no-strays': noStraysRule,
    'no-codeowners-edit': noCodeownersEditRule,
  },
} as const;

export default plugin;
