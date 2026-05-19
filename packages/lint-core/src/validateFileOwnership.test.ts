import { describe, expect, it } from 'bun:test';
import { defineOwnheim } from '@ownheim/core/defineOwnheim';
import { validateFileOwnership } from './validateFileOwnership.ts';

const config = defineOwnheim({
  fallback: 'Platform',
  teams: {
    Billing: { github: '@org/billing', owns: ['packages/billing/**'] },
    Platform: { github: '@org/platform' },
  },
});

const configNoFallback = defineOwnheim({
  teams: {
    Billing: { github: '@org/billing', owns: ['packages/billing/**'] },
  },
});

describe('validateFileOwnership', () => {
  it('returns no diagnostics when a rule matches', () => {
    const result = validateFileOwnership({
      filePath: 'packages/billing/charge.ts',
      sourceText: 'export const x = 1;\n',
      config,
    });
    expect(result).toEqual([]);
  });

  it('returns no diagnostics when a JSDoc @owner is present', () => {
    const result = validateFileOwnership({
      filePath: 'tools/deploy.ts',
      sourceText: '/** @owner Billing */\nexport const x = 1;\n',
      config,
    });
    expect(result).toEqual([]);
  });

  it('flags files matched only by the fallback rule', () => {
    const result = validateFileOwnership({
      filePath: 'tools/deploy.ts',
      sourceText: 'export const x = 1;\n',
      config,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.ruleId).toBe('no-ownheim');
    expect(result[0]?.message).toContain('fallback');
    expect(result[0]?.fix?.insertText).toBe('/** @owner TODO */\n');
  });

  it('flags files with no rule and no fallback', () => {
    const result = validateFileOwnership({
      filePath: 'tools/deploy.ts',
      sourceText: 'export const x = 1;\n',
      config: configNoFallback,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.ruleId).toBe('no-ownheim');
    expect(result[0]?.message).toContain('no rule matched');
  });

  it('flags files whose JSDoc references an unknown owner', () => {
    const result = validateFileOwnership({
      filePath: 'packages/billing/x.ts',
      sourceText: '/** @owner Nonexistent */\nexport const x = 1;\n',
      config: configNoFallback,
    });
    expect(result).toHaveLength(1);
  });
});
