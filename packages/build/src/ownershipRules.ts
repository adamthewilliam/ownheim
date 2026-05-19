import type { OwnheimConfig, Team } from '@ownheim/core/types';
import { compareSpecificity } from './globMatcher.ts';

export interface OwnershipRulePlanEntry {
  readonly glob: string;
  readonly teams: readonly string[];
}

export function planOwnershipRules<TTeams extends Record<string, Team>>(
  config: OwnheimConfig<TTeams>,
): readonly OwnershipRulePlanEntry[] {
  const rules: OwnershipRulePlanEntry[] = [];

  for (const [teamId, team] of Object.entries(config.teams)) {
    for (const glob of team.owns ?? []) {
      rules.push({ glob, teams: [teamId] });
    }
  }

  for (const rule of config.shared ?? []) {
    rules.push({ glob: rule.glob, teams: rule.owners });
  }

  return rules;
}

export function mostSpecificRulesFirst(
  rules: readonly OwnershipRulePlanEntry[],
): readonly OwnershipRulePlanEntry[] {
  return rules.slice().sort((a, b) => compareSpecificity(b.glob, a.glob));
}

export function codeownersRulesFirst(
  rules: readonly OwnershipRulePlanEntry[],
): readonly OwnershipRulePlanEntry[] {
  return rules.slice().sort((a, b) => compareSpecificity(a.glob, b.glob));
}

export function getFallbackTeam<TTeams extends Record<string, Team>>(
  config: OwnheimConfig<TTeams>,
): string | undefined {
  return Object.entries(config.teams).find(([, team]) => team.fallback)?.[0];
}
