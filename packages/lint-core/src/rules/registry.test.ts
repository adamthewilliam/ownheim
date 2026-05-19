import { describe, expect, it } from 'bun:test';
import { rules } from './registry.ts';

describe('lint-core rule registry', () => {
  it('every RegisteredRule.meta.id is unique', () => {
    const ids = rules.map((r) => r.meta.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has a callable validate that returns an array', () => {
    for (const r of rules) {
      expect(typeof r.definition.validate).toBe('function');
      const out = r.definition.validate({
        filePath: 'unrelated.ts',
        sourceText: '',
        options: undefined,
      });
      expect(Array.isArray(out)).toBe(true);
    }
  });

  it('rules length matches the count of validator modules in lint-core', () => {
    // Two validator modules currently exist: noOwnheim + noCodeownersEdit.
    // This guards against forgetting to register a new validator.
    expect(rules).toHaveLength(2);
  });

  it('exposes the expected rule ids', () => {
    expect(rules.map((r) => r.meta.id).sort()).toEqual(
      ['no-codeowners-edit', 'no-ownheim'].sort(),
    );
  });
});
