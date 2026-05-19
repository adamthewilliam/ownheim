import type { Team, OwnheimConfig } from './types.ts';

export function defineOwnheim<const TTeams extends Record<string, Team>>(
  config: OwnheimConfig<TTeams>,
): OwnheimConfig<TTeams> {
  const fallbackTeams = Object.entries(config.teams).filter(([, team]) => team.fallback);
  if (fallbackTeams.length > 1) {
    throw new Error(
      `defineOwnheim: at most one team may have fallback: true, found ${fallbackTeams.length} (${fallbackTeams.map(([id]) => id).join(', ')})`,
    );
  }

  if (config.shared) {
    for (const rule of config.shared) {
      for (const teamId of rule.owners) {
        if (!(teamId in config.teams)) {
          throw new Error(
            `defineOwnheim: shared rule for glob '${rule.glob}' references unknown team '${teamId}'`,
          );
        }
      }
    }
  }

  return config;
}
