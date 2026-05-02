import type { LintRuleDefinition, LintRuleOptions } from '../adapter.ts';
import { noStraysRule } from './noStrays.ts';
import { noCodeownersEditRule } from './noCodeownersEdit.ts';

/**
 * Adapter-neutral metadata. Each adapter package projects this into its
 * own native rule shape (oxlint flat description, eslint nested docs+schema).
 */
export interface RuleMeta {
  readonly id: string;
  readonly description: string;
  readonly category: 'problem' | 'suggestion';
  readonly fixable: boolean;
  /** JSON-schema-ish shape of options[0], or null when the rule takes no options. */
  readonly optionsSchema: 'lint-rule-options' | null;
}

export interface RegisteredRule<TOptions = LintRuleOptions> {
  readonly meta: RuleMeta;
  readonly definition: LintRuleDefinition<TOptions>;
}

export const rules: ReadonlyArray<RegisteredRule<unknown>> = [
  {
    meta: {
      id: 'no-strays',
      description: 'every source file must resolve to an explicit (non-fallback) owner',
      category: 'problem',
      fixable: true,
      optionsSchema: 'lint-rule-options',
    },
    definition: noStraysRule as LintRuleDefinition<unknown>,
  },
  {
    meta: {
      id: 'no-codeowners-edit',
      description: '.github/CODEOWNERS is generated; do not hand-edit',
      category: 'problem',
      fixable: false,
      optionsSchema: null,
    },
    definition: noCodeownersEditRule as LintRuleDefinition<unknown>,
  },
];
