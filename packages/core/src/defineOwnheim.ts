import type { Team, OwnheimConfig } from './types.ts';

export function defineOwnheim<const TTeams extends Record<string, Team>>(
  config: OwnheimConfig<TTeams>,
): OwnheimConfig<TTeams> {
  if (config.fallback !== undefined && !(config.fallback in config.teams)) {
    throw new Error(`defineOwnheim: fallback references unknown team '${config.fallback}'`);
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
