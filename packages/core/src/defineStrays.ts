import type { Team, StraysConfig } from './types.ts';

export function defineStrays<const TTeams extends Record<string, Team>>(
  config: StraysConfig<TTeams>,
): StraysConfig<TTeams> {
  const fallbackTeams = Object.entries(config.teams).filter(([, team]) => team.fallback);
  if (fallbackTeams.length > 1) {
    throw new Error(
      `defineStrays: at most one team may have fallback: true, found ${fallbackTeams.length} (${fallbackTeams.map(([id]) => id).join(', ')})`,
    );
  }

  if (config.shared) {
    for (const rule of config.shared) {
      for (const teamId of rule.owners) {
        if (!(teamId in config.teams)) {
          throw new Error(
            `defineStrays: shared rule for glob '${rule.glob}' references unknown team '${teamId}'`,
          );
        }
      }
    }
  }

  return config;
}
