export type { Diagnostic, FixSuggestion, Severity } from './types.ts';
export { runRule } from './adapter.ts';
export type { LintAdapter, LintRuleDefinition, LintRuleOptions } from './adapter.ts';
export { validateFileOwnership } from './validateFileOwnership.ts';
export type { ValidateOptions } from './validateFileOwnership.ts';
export { validateCodeownersEdit } from './validateCodeownersEdit.ts';
export type { CodeownersEditOptions } from './validateCodeownersEdit.ts';
