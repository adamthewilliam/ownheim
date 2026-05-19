import type { Team, OwnheimConfig } from '@ownheim/core/types';
import type { Diagnostic } from './types.ts';

export interface LintRuleOptions<TTeams extends Record<string, Team> = Record<string, Team>> {
  readonly config: OwnheimConfig<TTeams>;
}

/**
 * Adapter-agnostic surface every lint rule needs. Each linter (eslint, oxlint)
 * implements this once; rule logic is written against the interface and runs
 * unchanged on any adapter.
 */
export interface LintAdapter<TContext> {
  readonly getFilename: (ctx: TContext) => string;
  readonly getSourceText: (ctx: TContext) => string;
  readonly getOptions: <TOptions>(ctx: TContext) => TOptions | undefined;
  readonly report: (ctx: TContext, diagnostic: Diagnostic) => void;
}

export interface LintRuleDefinition<TOptions = LintRuleOptions> {
  readonly validate: (input: {
    readonly filePath: string;
    readonly sourceText: string;
    readonly options: TOptions | undefined;
  }) => Diagnostic[];
}

export const runRule = <TContext, TOptions>(
  adapter: LintAdapter<TContext>,
  definition: LintRuleDefinition<TOptions>,
  context: TContext,
): void => {
  const diagnostics = definition.validate({
    filePath: adapter.getFilename(context),
    sourceText: adapter.getSourceText(context),
    options: adapter.getOptions<TOptions>(context),
  });
  for (const d of diagnostics) adapter.report(context, d);
};
