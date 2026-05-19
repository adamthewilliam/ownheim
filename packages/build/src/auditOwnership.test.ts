import { describe, expect, it } from 'bun:test';
import { defineOwnheim } from '@ownheim/core/defineOwnheim';
import { auditSourceFile } from './auditOwnership.ts';

const config = defineOwnheim({
  teams: {
    Billing: { github: '@org/billing', owns: ['packages/billing/**'] },
    Identity: { github: '@org/identity' },
    Platform: { github: '@org/platform', fallback: true },
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
});
