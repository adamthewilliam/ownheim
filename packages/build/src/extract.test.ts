import { describe, expect, it } from 'bun:test';
import { extractFromSourceText } from './extract.ts';

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
