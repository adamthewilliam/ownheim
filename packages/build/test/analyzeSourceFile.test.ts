import { describe, expect, it } from 'bun:test';
import { analyzeSourceFile, extractFromSourceText } from '../src/analyzeSourceFile.ts';

describe('extractFromSourceText', () => {
  it('reads @owner from a leading JSDoc block comment', () => {
    const result = extractFromSourceText('a.ts', `/** @owner Billing */\nexport const x = 1;\n`);
    expect(result.jsdocOwner).toBe('Billing');
  });

  it('reads @owner from a leading line comment', () => {
    const result = extractFromSourceText('a.ts', `// @owner Identity\nexport const x = 1;\n`);
    expect(result.jsdocOwner).toBe('Identity');
  });

  it('returns undefined when @owner is missing', () => {
    const result = extractFromSourceText('a.ts', `export const x = 1;\n`);
    expect(result.jsdocOwner).toBeUndefined();
  });

  it('does not match @owner inside non-leading comments', () => {
    const result = extractFromSourceText('a.ts', `export const x = 1;\n// @owner Billing\n`);
    expect(result.jsdocOwner).toBeUndefined();
  });

  it('extracts OwnedError subclass owners from super() calls', () => {
    const source = `
import { OwnedError } from '@ownheim/core/OwnedError';

export class BillingError extends OwnedError {
  constructor(message: string, public code: string) {
    super(message, 'Billing');
  }
}
    `;
    const result = extractFromSourceText('errors.ts', source);
    expect(result.ownedErrorConstructions).toHaveLength(1);
    expect(result.ownedErrorConstructions[0]?.className).toBe('BillingError');
    expect(result.ownedErrorConstructions[0]?.owner).toBe('Billing');
  });

  it('handles multiple OwnedError subclasses in one file', () => {
    const source = `
import { OwnedError } from '@ownheim/core/OwnedError';

class A extends OwnedError { constructor(m: string) { super(m, 'Billing'); } }
class B extends OwnedError { constructor(m: string) { super(m, 'Platform'); } }
    `;
    const result = extractFromSourceText('errors.ts', source);
    expect(result.ownedErrorConstructions.map((c) => c.owner).sort()).toEqual(['Billing', 'Platform']);
  });

  it('ignores classes that do not extend OwnedError', () => {
    const result = extractFromSourceText('a.ts', `class Regular { constructor() {} }\nclass Extended extends Error { constructor() { super(); } }\n`);
    expect(result.ownedErrorConstructions).toHaveLength(0);
  });
});

describe('analyzeSourceFile.transform', () => {
  it('does not rewrite logger imports; users bring their own logger', () => {
    const source = `import { logger } from '@ownheim/core';\n`;
    const out = analyzeSourceFile('a.ts', source).transform('Billing');
    expect(out).toContain(`import { logger } from '@ownheim/core';`);
    expect(out).not.toContain('createLogger');
    expect(out).toContain('const __OWNER__ = "Billing";');
  });

  it('leaves type-only runtime imports alone', () => {
    const source = `import type { logger } from '@ownheim/core';\n`;
    const out = analyzeSourceFile('a.ts', source).transform('Billing');
    expect(out).toContain(`import type { logger } from '@ownheim/core';`);
    expect(out).not.toContain('createLogger');
  });

  it('leaves namespace imports alone', () => {
    const source = `import * as runtime from '@ownheim/core';\nruntime.logger.info({ msg: 'hi' });\n`;
    const out = analyzeSourceFile('a.ts', source).transform('Billing');
    expect(out).toContain(`import * as runtime from '@ownheim/core';`);
    expect(out).toContain('runtime.logger.info');
    expect(out).not.toContain('createLogger');
  });

  it('preserves non-factory named imports', () => {
    const source = `import { logger, runWithEntrypointOwner } from '@ownheim/core';\n`;
    const out = analyzeSourceFile('a.ts', source).transform('Billing');
    expect(out).toContain('logger');
    expect(out).toContain('runWithEntrypointOwner');
    expect(out).not.toContain('createLogger');
  });

  it('still extracts @owner JSDoc on the analyzed-file path', () => {
    const analyzed = analyzeSourceFile('a.ts', `/** @owner Billing */\nexport const x = 1;\n`);
    expect(analyzed.jsdocOwner).toBe('Billing');
  });

  it('extracts OwnedError owners on the analyzed-file path', () => {
    const source = `
import { OwnedError } from '@ownheim/core/OwnedError';
export class BillingError extends OwnedError { constructor(m: string) { super(m, 'Billing'); } }
`;
    const analyzed = analyzeSourceFile('errors.ts', source);
    expect(analyzed.ownedErrorConstructions).toHaveLength(1);
    expect(analyzed.ownedErrorConstructions[0]?.owner).toBe('Billing');
  });

  it('injects __OWNER__ after directives', () => {
    const out = analyzeSourceFile('a.ts', `"use strict";\nexport const x = 1;\n`).transform('Identity');
    expect(out.indexOf('const __OWNER__')).toBeGreaterThan(out.indexOf('"use strict"'));
  });

  it('is idempotent for __OWNER__', () => {
    const once = analyzeSourceFile('a.ts', `export const x = 1;\n`).transform('Billing');
    const twice = analyzeSourceFile('a.ts', once).transform('Billing');
    expect((twice.match(/const __OWNER__\s*=/g) ?? []).length).toBe(1);
  });

  it('can transform the same analyzed file with different owners', () => {
    const analyzed = analyzeSourceFile('a.ts', `export const x = 1;\n`);
    expect(analyzed.transform('Billing')).toContain('const __OWNER__ = "Billing";');
    expect(analyzed.transform('Identity')).toContain('const __OWNER__ = "Identity";');
  });

  it('does not rewrite tracer imports; users bring their own tracer', () => {
    const out = analyzeSourceFile('a.ts', `import { tracer } from '@ownheim/core';\n`).transform('Billing');
    expect(out).toContain(`import { tracer } from '@ownheim/core';`);
    expect(out).not.toContain('createTracer');
  });

  it('preserves logger and tracer imports in the same import', () => {
    const out = analyzeSourceFile('a.ts', `import { logger, tracer } from '@ownheim/core';\n`).transform('Billing');
    expect(out).toContain('logger');
    expect(out).toContain('tracer');
    expect(out).not.toContain('createLogger');
    expect(out).not.toContain('createTracer');
  });

  it('does not touch unrelated imports', () => {
    const source = `import { x } from 'other';\nimport { y } from '../src/local.ts';\n`;
    const out = analyzeSourceFile('a.ts', source).transform('Billing');
    expect(out).toContain(`import { x } from 'other';`);
    expect(out).toContain(`import { y } from '../src/local.ts';`);
    expect(out).not.toContain('createLogger');
  });
});
