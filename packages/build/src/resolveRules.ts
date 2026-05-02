import type { ResolvedOwner, Rule, StraysConfig, Owner } from '@strays/core/types';
import { matches, compareSpecificity } from './globMatcher.ts';

export interface ResolveInput {
  readonly filePath: string;
  readonly jsdocOwner?: string | undefined;
}

export function resolveOwnerForFile<TOwners extends Record<string, Owner>>(
  config: StraysConfig<TOwners>,
  input: ResolveInput,
): ResolvedOwner | undefined {
  if (input.jsdocOwner) {
    if (input.jsdocOwner in config.owners) {
      return {
        file: input.filePath,
        owners: [input.jsdocOwner],
        source: 'jsdoc',
      };
    }
    // JSDoc references unknown owner - treat as missing so the linter flags it
    return undefined;
  }

  const matched = config.rules
    .filter((r) => !r.fallback)
    .filter((r) => matches(r.glob, input.filePath))
    .sort((a, b) => compareSpecificity(b.glob, a.glob));

  if (matched.length > 0) {
    const best = matched[0]!;
    return {
      file: input.filePath,
      owners: ownersOf(best),
      source: 'rule',
      matchedGlob: best.glob,
    };
  }

  const fallback = config.rules.find((r) => r.fallback);
  if (fallback) {
    return {
      file: input.filePath,
      owners: ownersOf(fallback),
      source: 'fallback',
      matchedGlob: fallback.glob,
    };
  }

  return undefined;
}

export function resolveAll<TOwners extends Record<string, Owner>>(
  config: StraysConfig<TOwners>,
  files: readonly ResolveInput[],
): ResolvedOwner[] {
  return files
    .map((f) => resolveOwnerForFile(config, f))
    .filter((r): r is ResolvedOwner => r !== undefined);
}

function ownersOf(rule: Rule): readonly string[] {
  const o = rule.owner;
  return Array.isArray(o) ? (o as readonly string[]) : [o as string];
}
