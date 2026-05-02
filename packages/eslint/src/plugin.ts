import { rules } from '@strays/lint-core/rules/registry';
import { projectEslintRule } from './adapter.ts';

export const plugin = {
  meta: { name: '@strays/eslint', version: '0.1.0' },
  rules: Object.fromEntries(rules.map((r) => [r.meta.id, projectEslintRule(r)])),
} as const;

export default plugin;
