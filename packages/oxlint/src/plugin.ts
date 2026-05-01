import { noStraysRule } from './rules/no-strays.ts';
import { noCodeownersEditRule } from './rules/no-codeowners-edit.ts';

export const plugin = {
  name: '@strays/oxlint',
  meta: { name: '@strays', version: '0.1.0' },
  rules: {
    'no-strays': noStraysRule,
    'no-codeowners-edit': noCodeownersEditRule,
  },
} as const;

export default plugin;
