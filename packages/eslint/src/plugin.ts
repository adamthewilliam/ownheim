import { rules } from '@ownheim/lint-core/rules/registry';
import { projectEslintRule } from './adapter.ts';

export const plugin = {
  meta: { name: '@ownheim/eslint', version: '0.1.0' },
  rules: Object.fromEntries(rules.map((r) => [r.meta.id, projectEslintRule(r)])),
} as const;

export default plugin;
