import type { ResolvedOwnership, StraysConfig, Team } from '@strays/core/types';
import { matches, compareSpecificity } from './globMatcher.ts';

export interface ResolveInput {
  readonly filePath: string;
  readonly jsdocOwner?: string | undefined;
}

interface InternalRule {
  readonly glob: string;
  readonly teams: readonly string[];
}

function flattenRules<TTeams extends Record<string, Team>>(
  config: StraysConfig<TTeams>,
): readonly InternalRule[] {
  const rules: InternalRule[] = [];

  for (const [teamId, team] of Object.entries(config.teams)) {
    if (team.owns) {
      for (const glob of team.owns) {
        rules.push({ glob, teams: [teamId] });
      }
    }
  }

  if (config.shared) {
    for (const rule of config.shared) {
      rules.push({ glob: rule.glob, teams: rule.owners });
    }
  }

  return rules;
}

function getFallbackTeam<TTeams extends Record<string, Team>>(
  config: StraysConfig<TTeams>,
): string | undefined {
  for (const [teamId, team] of Object.entries(config.teams)) {
    if (team.fallback) return teamId;
  }
  return undefined;
}

export function resolveOwnerForFile<TTeams extends Record<string, Team>>(
  config: StraysConfig<TTeams>,
  input: ResolveInput,
): ResolvedOwnership | undefined {
  if (input.jsdocOwner) {
    if (input.jsdocOwner in config.teams) {
      return {
        file: input.filePath,
        teams: [input.jsdocOwner],
        source: 'jsdoc',
      };
    }
    return undefined;
  }

  const rules = flattenRules(config);
  const matched = rules
    .filter((r) => matches(r.glob, input.filePath))
    .sort((a, b) => compareSpecificity(b.glob, a.glob));

  if (matched.length > 0) {
    const best = matched[0]!;
    return {
      file: input.filePath,
      teams: best.teams,
      source: 'rule',
      matchedGlob: best.glob,
    };
  }

  const fallbackTeam = getFallbackTeam(config);
  if (fallbackTeam) {
    return {
      file: input.filePath,
      teams: [fallbackTeam],
      source: 'fallback',
    };
  }

  return undefined;
}

export function resolveAll<TTeams extends Record<string, Team>>(
  config: StraysConfig<TTeams>,
  files: readonly ResolveInput[],
): ResolvedOwnership[] {
  return files
    .map((f) => resolveOwnerForFile(config, f))
    .filter((r): r is ResolvedOwnership => r !== undefined);
}
