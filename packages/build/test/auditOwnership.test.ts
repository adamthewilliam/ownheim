import { describe, expect, it } from 'bun:test';
import { defineOwnheim } from '@ownheim/core/defineOwnheim';
import { auditSourceFile, auditSourceFiles, explainOwnershipAudit } from '../src/auditOwnership.ts';

const config = defineOwnheim({
  fallback: 'Platform',
  teams: {
    Billing: { github: '@org/billing', owns: ['packages/billing/**'] },
    Identity: { github: '@org/identity' },
    Platform: { github: '@org/platform' },
  },
});

describe('auditSourceFile', () => {
  it('classifies rule ownership as explicit', () => {
    const audit = auditSourceFile(config, {
      filePath: 'packages/billing/charge.ts',
      sourceText: 'export const charge = true;',
    });

    expect(audit.status).toBe('explicit');
    expect(audit.isExplicit).toBe(true);
    expect(audit.needsAttention).toBe(false);
    expect(audit.resolved?.source).toBe('rule');
  });

  it('classifies valid JSDoc ownership as explicit', () => {
    const audit = auditSourceFile(config, {
      filePath: 'packages/billing/charge.ts',
      sourceText: '/** @owner Identity */\nexport const charge = true;',
    });

    expect(audit.status).toBe('explicit');
    expect(audit.jsdocOwner).toBe('Identity');
    expect(audit.resolved?.source).toBe('jsdoc');
  });

  it('classifies fallback ownership separately from explicit ownership', () => {
    const audit = auditSourceFile(config, {
      filePath: 'tools/deploy.ts',
      sourceText: 'export const deploy = true;',
    });

    expect(audit.status).toBe('fallback');
    expect(audit.isExplicit).toBe(false);
    expect(audit.needsAttention).toBe(true);
    expect(audit.resolved?.source).toBe('fallback');
  });

  it('classifies files with no matching rule and no fallback as unowned', () => {
    const cfg = defineOwnheim({
      teams: { Billing: { github: '@org/billing', owns: ['packages/billing/**'] } },
    });

    const audit = auditSourceFile(cfg, {
      filePath: 'tools/deploy.ts',
      sourceText: 'export const deploy = true;',
    });

    expect(audit.status).toBe('unowned');
    expect(audit.resolved).toBeUndefined();
  });

  it('classifies unknown JSDoc owners as invalid', () => {
    const audit = auditSourceFile(config, {
      filePath: 'packages/billing/charge.ts',
      sourceText: '/** @owner Nope */\nexport const charge = true;',
    });

    expect(audit.status).toBe('invalid-jsdoc-owner');
    expect(audit.jsdocOwner).toBe('Nope');
    expect(audit.resolved).toBeUndefined();
  });

  it('does not mask invalid JSDoc owners with a rule or fallback', () => {
    const audit = auditSourceFile(config, {
      filePath: 'tools/deploy.ts',
      sourceText: '/** @owner Nope */\nexport const deploy = true;',
    });

    expect(audit.status).toBe('invalid-jsdoc-owner');
    expect(audit.resolved).toBeUndefined();
  });

  it('explains fallback ownership without an undefined matched glob', () => {
    const audit = auditSourceFile(config, {
      filePath: 'tools/deploy.ts',
      sourceText: 'export const deploy = true;',
    });

    expect(explainOwnershipAudit(audit).explanation).toBe('tools/deploy.ts -> Platform (FALLBACK)');
  });

  it('summarizes project ownership audits for downstream callers', () => {
    const report = auditSourceFiles(config, [
      { filePath: 'packages/billing/charge.ts', sourceText: 'export const charge = true;' },
      { filePath: 'tools/deploy.ts', sourceText: 'export const deploy = true;' },
      { filePath: 'other.ts', sourceText: '/** @owner Nope */\nexport const other = true;' },
    ]);

    expect(report.total).toBe(3);
    expect(report.explicit).toBe(1);
    expect(report.fallback).toBe(1);
    expect(report.invalidOwner).toBe(1);
    expect(report.needsAttention).toBe(2);
    expect(report.coveragePercent).toBe(33.3);
    expect(report.resolved.map((r) => r.file)).toEqual(['packages/billing/charge.ts', 'tools/deploy.ts']);
    expect(report.needsAttentionFiles).toEqual(['tools/deploy.ts', 'other.ts']);
  });
});
