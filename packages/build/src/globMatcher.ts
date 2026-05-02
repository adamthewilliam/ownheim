import picomatch from 'picomatch';

/** True iff `glob` matches `file` under strays' canonical glob semantics (dotfiles included). */
export function matches(glob: string, file: string): boolean {
  return picomatch(glob, { dot: true })(file);
}

/**
 * Heuristic score: more literal characters => more specific.
 * Wildcard runs (`*`, `**`, `?`) contribute nothing. Higher = more specific.
 * Stable across releases; callers MUST treat it as opaque and only compare values.
 */
export function specificity(glob: string): number {
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

/** Comparator usable with Array#sort. Negative => a is less specific than b. */
export function compareSpecificity(a: string, b: string): number {
  return specificity(a) - specificity(b);
}
