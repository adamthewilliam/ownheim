import { describe, expect, it } from 'bun:test';
import { matches, specificity, compareSpecificity } from '../src/globMatcher.ts';

describe('specificity', () => {
  it('orders broad < scoped < literal', () => {
    expect(specificity('**')).toBeLessThan(specificity('packages/x/**'));
    expect(specificity('packages/x/**')).toBeLessThan(specificity('packages/x/foo.ts'));
  });

  it('does not count wildcard segments', () => {
    expect(specificity('packages/*/foo.ts')).toBeLessThan(specificity('packages/x/foo.ts'));
  });

  it("treats '?' as a wildcard, not a literal", () => {
    // 'a?.ts' has literals: a, ., t, s = 4. 'a.ts' has 4.
    // Pin the heuristic: '?' contributes nothing, so 'a?.ts' equals literals of 'a.ts' minus the '?' which is zero,
    // giving 'a?.ts' === specificity('a.ts') - 0; but 'a.ts' literals are a,.,t,s = 4 and 'a?.ts' literals are a,.,t,s = 4 too.
    // The RFC phrasing "minus one literal" is approximate; what we pin is that '?' contributes nothing.
    expect(specificity('a?.ts')).toBe(specificity('a.ts'));
  });

  it('collapses consecutive wildcards', () => {
    expect(specificity('***')).toBe(specificity('*'));
  });
});

describe('matches', () => {
  it('matches files under a recursive prefix', () => {
    expect(matches('packages/billing/**', 'packages/billing/admin/x.ts')).toBe(true);
  });

  it('does not match unrelated paths', () => {
    expect(matches('packages/billing/**', 'packages/auth/x.ts')).toBe(false);
  });

  it('honours dotfiles via { dot: true }', () => {
    expect(matches('**/*.ts', '.config/foo.ts')).toBe(true);
  });
});

describe('compareSpecificity', () => {
  it('returns a negative number when a is less specific than b', () => {
    expect(compareSpecificity('**', 'packages/x/foo.ts')).toBeLessThan(0);
  });

  it('returns a positive number when a is more specific than b', () => {
    expect(compareSpecificity('packages/x/foo.ts', '**')).toBeGreaterThan(0);
  });

  it('returns zero for equal-specificity globs', () => {
    expect(compareSpecificity('a.ts', 'b.ts')).toBe(0);
  });

  it('is consistent with specificity', () => {
    const pairs: ReadonlyArray<readonly [string, string]> = [
      ['**', 'packages/x/**'],
      ['packages/*/foo.ts', 'packages/x/foo.ts'],
      ['a.ts', 'a?.ts'],
      ['***', '*'],
      ['packages/billing/**', 'packages/billing/admin/**'],
    ];
    for (const [a, b] of pairs) {
      expect(Math.sign(compareSpecificity(a, b))).toBe(Math.sign(specificity(a) - specificity(b)));
    }
  });
});
