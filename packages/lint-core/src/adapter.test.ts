import { describe, expect, it } from 'bun:test';
import type { Diagnostic } from './types.ts';
import { runRule, type LintAdapter, type LintRuleDefinition } from './adapter.ts';

interface FakeContext {
  filename: string;
  source: string;
  options: { greeting: string } | undefined;
  reported: Diagnostic[];
}

const fakeAdapter: LintAdapter<FakeContext> = {
  getFilename: (ctx) => ctx.filename,
  getSourceText: (ctx) => ctx.source,
  getOptions: <T>(ctx: FakeContext) => ctx.options as T | undefined,
  report: (ctx, d) => ctx.reported.push(d),
};

const echoRule: LintRuleDefinition<{ greeting: string }> = {
  validate: ({ filePath, options }) => {
    if (!options) return [];
    return [
      {
        ruleId: 'echo',
        severity: 'error',
        message: `${options.greeting} ${filePath}`,
        line: 1,
        column: 1,
      },
    ];
  },
};

describe('runRule', () => {
  it('dispatches each diagnostic through the adapter', () => {
    const ctx: FakeContext = {
      filename: 'src/x.ts',
      source: '',
      options: { greeting: 'hi' },
      reported: [],
    };
    runRule(fakeAdapter, echoRule, ctx);
    expect(ctx.reported).toHaveLength(1);
    expect(ctx.reported[0]?.message).toBe('hi src/x.ts');
  });

  it('passes undefined options through to the rule when adapter has none', () => {
    const ctx: FakeContext = {
      filename: 'src/x.ts',
      source: '',
      options: undefined,
      reported: [],
    };
    runRule(fakeAdapter, echoRule, ctx);
    expect(ctx.reported).toEqual([]);
  });

  it('reports zero diagnostics when validate returns empty', () => {
    const noopRule: LintRuleDefinition<never> = { validate: () => [] };
    const ctx: FakeContext = {
      filename: 'src/x.ts',
      source: '',
      options: undefined,
      reported: [],
    };
    runRule(fakeAdapter, noopRule, ctx);
    expect(ctx.reported).toEqual([]);
  });
});
