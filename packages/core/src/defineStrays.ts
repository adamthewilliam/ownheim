import type { Owner, StraysConfig } from './types.ts';

export function defineStrays<const TOwners extends Record<string, Owner>>(
  config: StraysConfig<TOwners>,
): StraysConfig<TOwners> {
  const fallbackCount = config.rules.filter((r) => r.fallback).length;
  if (fallbackCount > 1) {
    throw new Error(
      `defineStrays: at most one rule may have fallback: true, found ${fallbackCount}`,
    );
  }

  for (const rule of config.rules) {
    const owners = Array.isArray(rule.owner) ? rule.owner : [rule.owner];
    for (const ownerId of owners) {
      if (!(ownerId in config.owners)) {
        throw new Error(
          `defineStrays: rule for glob '${rule.glob}' references unknown owner '${ownerId}'`,
        );
      }
    }
  }

  return config;
}
