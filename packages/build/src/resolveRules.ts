import type { ResolvedOwnership, OwnheimConfig, Team } from '@ownheim/core/types';
import { matches } from './globMatcher.ts';
import { getFallbackTeam, mostSpecificRulesFirst, planOwnershipRules } from './ownershipRules.ts';

export interface ResolveInput {
  readonly filePath: string;
  readonly jsdocOwner?: string | undefined;
}

export function resolveOwnerForFile<TTeams extends Record<string, Team>>(
  config: OwnheimConfig<TTeams>,
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

  const matched = mostSpecificRulesFirst(
    planOwnershipRules(config).filter((r) => matches(r.glob, input.filePath)),
  );

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
  config: OwnheimConfig<TTeams>,
  files: readonly ResolveInput[],
): ResolvedOwnership[] {
  return files
    .map((f) => resolveOwnerForFile(config, f))
    .filter((r): r is ResolvedOwnership => r !== undefined);
}
