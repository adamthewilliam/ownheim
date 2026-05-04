import { describe, expect, it } from 'bun:test';
import { analyzeSourceFile, extractFromSourceText } from './analyzeSourceFile.ts';

// ---------------------------------------------------------------------------
// Ported extract.test.ts (7 cases) — unchanged semantics, new entry point.
// ---------------------------------------------------------------------------
describe('extractFromSourceText', () => {
  it('reads @owner from a leading JSDoc block comment', () => {
    const source = `/** @owner Billing */\nexport const x = 1;\n`;
    const result = extractFromSourceText('a.ts', source);
    expect(result.jsdocOwner).toBe('Billing');
  });

  it('reads @owner from a leading line comment', () => {
    const source = `// @owner Identity\nexport const x = 1;\n`;
    const result = extractFromSourceText('a.ts', source);
    expect(result.jsdocOwner).toBe('Identity');
  });

  it('returns undefined when @owner is missing', () => {
    const result = extractFromSourceText('a.ts', `export const x = 1;\n`);
    expect(result.jsdocOwner).toBeUndefined();
  });

  it('does not match @owner inside non-leading comments', () => {
    const source = `export const x = 1;\n// @owner Billing\n`;
    const result = extractFromSourceText('a.ts', source);
    expect(result.jsdocOwner).toBeUndefined();
  });

  it('extracts OwnedError subclass owners from super() calls', () => {
    const source = `
import { OwnedError } from '@strays/core/OwnedError';

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
import { OwnedError } from '@strays/core/OwnedError';

class A extends OwnedError {
  constructor(m: string) { super(m, 'Billing'); }
}
class B extends OwnedError {
  constructor(m: string) { super(m, 'Platform'); }
}
    `;
    const result = extractFromSourceText('errors.ts', source);
    expect(result.ownedErrorConstructions.map((c) => c.owner).sort()).toEqual([
      'Billing',
      'Platform',
    ]);
  });

  it('ignores classes that do not extend OwnedError', () => {
    const source = `
class Regular { constructor() {} }
class Extended extends Error { constructor() { super(); } }
    `;
    const result = extractFromSourceText('a.ts', source);
    expect(result.ownedErrorConstructions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// RFC §4 boundary tests for analyzeSourceFile.transform()
// ---------------------------------------------------------------------------
describe('analyzeSourceFile.transform', () => {
  // 1. Plain named import (regression)
  it('rewrites a single logger import to a createLogger factory call', () => {
    const out = analyzeSourceFile(
      'a.ts',
      `import { logger } from '@strays/core';\n`,
    ).transform('Billing');
    expect(out).toContain('createLogger');
    expect(out).toMatch(/from\s+['"]@strays\/core\/logging\/createLogger['"]/);
    expect(out).toMatch(/const logger\s*=\s*createLogger\(/);
    expect(out).toContain('"Billing"');
  });

  // 2. Type-only import is preserved (no rewrite)
  it('leaves type-only runtime imports alone', () => {
    const source = `import type { logger } from '@strays/core';\n`;
    const out = analyzeSourceFile('a.ts', source).transform('Billing');
    expect(out).toContain(`import type { logger } from '@strays/core';`);
    expect(out).not.toContain('createLogger');
    expect(out).not.toMatch(/const logger\s*=/);
  });

  // 3. Namespace import is preserved (Phase 1 — no warning, no rewrite)
  it('leaves namespace imports alone in Phase 1', () => {
    const source = `import * as runtime from '@strays/core';\nruntime.logger.info({ msg: 'hi' });\n`;
    const out = analyzeSourceFile('a.ts', source).transform('Billing');
    expect(out).toContain(`import * as runtime from '@strays/core';`);
    expect(out).toContain('runtime.logger.info');
    // The namespace usage is preserved verbatim — no factory init for it.
    expect(out).not.toMatch(/const runtime\s*=\s*createLogger/);
  });

  // 4. Mixed named imports — passthrough survives, factory init present
  it('rewrites factory-bound bindings while passing through unrelated bindings', () => {
    const source = `import { logger, runWithOwner } from '@strays/core';\n`;
    const out = analyzeSourceFile('a.ts', source).transform('Billing');
    expect(out).toMatch(/import\s+\{\s*runWithOwner\s*\}\s+from\s+['"]@strays\/core['"]/);
    expect(out).toMatch(/from\s+['"]@strays\/core\/logging\/createLogger['"]/);
    // Exactly one `const logger = createLogger(...)` initializer
    const matches = out.match(/const logger\s*=\s*createLogger\(/g) ?? [];
    expect(matches.length).toBe(1);
  });

  // 5. Aliased import → const <alias> = createLogger(...)
  it('honours import aliases', () => {
    const source = `import { logger as log } from '@strays/core';\n`;
    const out = analyzeSourceFile('a.ts', source).transform('Billing');
    expect(out).toMatch(/const log\s*=\s*createLogger\(/);
    expect(out).not.toMatch(/const logger\s*=/);
  });

  // 6. Re-export — Phase 1 preserves it verbatim (no silent corruption)
  it('preserves runtime re-exports verbatim in Phase 1', () => {
    const source = `export { logger } from '@strays/core';\n`;
    const out = analyzeSourceFile('a.ts', source).transform('Billing');
    expect(out).toContain(`export { logger } from '@strays/core';`);
    // No factory init injected for the re-exported symbol.
    expect(out).not.toMatch(/const logger\s*=\s*createLogger/);
  });

  // 7. Multi-line import with trailing comma + inline block comment
  it('handles multi-line imports with trailing commas and inline block comments', () => {
    const source = [
      'import {',
      '  logger,',
      '  /* keep */ runWithOwner,',
      "} from '@strays/core';",
      '',
    ].join('\n');
    const out = analyzeSourceFile('a.ts', source).transform('Billing');
    expect(out).toContain('runWithOwner');
    expect(out).toMatch(/from\s+['"]@strays\/core\/logging\/createLogger['"]/);
    expect(out).toMatch(/const logger\s*=\s*createLogger\(/);
  });

  // 8. @owner JSDoc still extracted (regression)
  it('still extracts @owner JSDoc on the analyzed-file path', () => {
    const source = `/** @owner Billing */\nexport const x = 1;\n`;
    const analyzed = analyzeSourceFile('a.ts', source);
    expect(analyzed.jsdocOwner).toBe('Billing');
  });

  // 9. OwnedError super-call still extracted (regression)
  it('extracts OwnedError owners on the analyzed-file path', () => {
    const source = `
import { OwnedError } from '@strays/core/OwnedError';

export class BillingError extends OwnedError {
  constructor(m: string) { super(m, 'Billing'); }
}
`;
    const analyzed = analyzeSourceFile('errors.ts', source);
    expect(analyzed.ownedErrorConstructions).toHaveLength(1);
    expect(analyzed.ownedErrorConstructions[0]?.owner).toBe('Billing');
  });

  // 10. Directive prologue preserved
  it('injects __OWNER__ after "use strict" directive', () => {
    const source = `"use strict";\nexport const x = 1;\n`;
    const out = analyzeSourceFile('a.ts', source).transform('Identity');
    // "use strict" must come before the __OWNER__ constant.
    const useStrictIdx = out.indexOf('"use strict"');
    const ownerIdx = out.indexOf('const __OWNER__');
    expect(useStrictIdx).toBeGreaterThanOrEqual(0);
    expect(ownerIdx).toBeGreaterThan(useStrictIdx);
  });

  it('injects __OWNER__ after "use client" directive', () => {
    const source = `"use client";\nexport const x = 1;\n`;
    const out = analyzeSourceFile('a.ts', source).transform('Platform');
    const useClientIdx = out.indexOf('"use client"');
    const ownerIdx = out.indexOf('const __OWNER__');
    expect(useClientIdx).toBeGreaterThanOrEqual(0);
    expect(ownerIdx).toBeGreaterThan(useClientIdx);
  });

  // 11. Empty owner string
  it('handles empty owner strings without breaking the contract', () => {
    const source = `import { logger } from '@strays/core';\n`;
    const out = analyzeSourceFile('a.ts', source).transform('');
    expect(out).toContain('const __OWNER__ = "";');
    expect(out).toMatch(/const logger\s*=\s*createLogger\(""\);/);
  });

  // 12. Idempotency — re-running transform doesn't double-inject
  it('is idempotent: rerunning transform on the output is a no-op for __OWNER__ and factory inits', () => {
    const source = `import { logger } from '@strays/core';\nlogger.info({ msg: 'hi' });\n`;
    const once = analyzeSourceFile('a.ts', source).transform('Billing');
    const twice = analyzeSourceFile('a.ts', once).transform('Billing');

    const ownerCount = (twice.match(/const __OWNER__\s*=/g) ?? []).length;
    expect(ownerCount).toBe(1);

    const factoryInitCount = (twice.match(/const logger\s*=\s*createLogger\(/g) ?? []).length;
    expect(factoryInitCount).toBe(1);

    const factoryImportCount = (
      twice.match(/from\s+['"]@strays\/core\/logging\/createLogger['"]/g) ?? []
    ).length;
    expect(factoryImportCount).toBe(1);
  });

  // Bonus regression: tracer rewriting (existing behavior preserved).
  it('rewrites tracer imports to createTracer factory calls', () => {
    const out = analyzeSourceFile(
      'a.ts',
      `import { tracer } from '@strays/core';\n`,
    ).transform('Billing');
    expect(out).toMatch(/from\s+['"]@strays\/core\/tracing\/createTracer['"]/);
    expect(out).toMatch(/const tracer\s*=\s*createTracer\(/);
  });

  it('rewrites both logger and tracer in the same import', () => {
    const out = analyzeSourceFile(
      'a.ts',
      `import { logger, tracer } from '@strays/core';\n`,
    ).transform('Billing');
    expect(out).toContain('createLogger');
    expect(out).toContain('createTracer');
  });

  it('does not touch unrelated imports', () => {
    const source = `import { x } from 'other';\nimport { y } from './local.ts';\n`;
    const out = analyzeSourceFile('a.ts', source).transform('Billing');
    expect(out).toContain(`import { x } from 'other';`);
    expect(out).toContain(`import { y } from './local.ts';`);
    expect(out).not.toContain('createLogger');
  });
});
