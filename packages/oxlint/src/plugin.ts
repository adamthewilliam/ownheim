import { rules } from '@strays/lint-core/rules/registry';
import { projectOxlintRule } from './adapter.ts';

export const plugin = {
  name: '@strays/oxlint',
  meta: { name: '@strays', version: '0.1.0' },
  rules: Object.fromEntries(rules.map((r) => [r.meta.id, projectOxlintRule(r)])),
} as const;

export default plugin;
