import picomatch from 'picomatch';
import type { ResolvedOwner, Rule, StraysConfig, Owner } from '@strays/core/types';

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

  const matches = config.rules
    .filter((r) => !r.fallback)
    .filter((r) => picomatch(r.glob, { dot: true })(input.filePath))
    .sort((a, b) => specificity(b.glob) - specificity(a.glob));

  if (matches.length > 0) {
    const best = matches[0]!;
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

function specificity(glob: string): number {
  // More literal characters = more specific. Wildcards reduce specificity.
  let score = 0;
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === '*' || c === '?') {
      // skip wildcards (and glob '**')
      while (i < glob.length && (glob[i] === '*' || glob[i] === '?')) i++;
      continue;
    }
    score++;
    i++;
  }
  return score;
}
