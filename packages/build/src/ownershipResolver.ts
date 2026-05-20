import type { OwnheimConfig, ResolvedOwnership, Team } from '@ownheim/core/types';
import picomatch from 'picomatch';
import {
  getFallbackTeam,
  mostSpecificRulesFirst,
  planOwnershipRules,
  type OwnershipRulePlanEntry,
} from './ownershipRules.ts';

export interface ResolveInput {
  readonly filePath: string;
  readonly jsdocOwner?: string | undefined;
}

interface CompiledOwnershipRule extends OwnershipRulePlanEntry {
  readonly matches: (file: string) => boolean;
}

export interface OwnershipResolver {
  resolve(input: ResolveInput): ResolvedOwnership | undefined;
  resolveAll(files: readonly ResolveInput[]): ResolvedOwnership[];
}

/**
 * Precomputes the stable config-derived work used by ownership resolution:
 * rule planning, specificity ordering, glob compilation, and fallback lookup.
 */
export function createOwnershipResolver<TTeams extends Record<string, Team>>(
  config: OwnheimConfig<TTeams>,
): OwnershipResolver {
  const rules: readonly CompiledOwnershipRule[] = mostSpecificRulesFirst(planOwnershipRules(config)).map(
    (rule) => ({ ...rule, matches: picomatch(rule.glob, { dot: true }) }),
  );
  const fallbackTeam = getFallbackTeam(config);

  const resolve = (input: ResolveInput): ResolvedOwnership | undefined => {
    // Invalid explicit ownership is treated as an error, not silently ignored.
    // Callers can surface this as an audit finding instead of masking it with a rule or fallback.
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

    for (const rule of rules) {
      if (!rule.matches(input.filePath)) continue;
      return {
        file: input.filePath,
        teams: rule.teams,
        source: 'rule',
        matchedGlob: rule.glob,
      };
    }

    if (fallbackTeam) {
      return {
        file: input.filePath,
        teams: [fallbackTeam],
        source: 'fallback',
      };
    }

    return undefined;
  };

  return {
    resolve,
    resolveAll: (files) => files.map(resolve).filter((r): r is ResolvedOwnership => r !== undefined),
  };
}
