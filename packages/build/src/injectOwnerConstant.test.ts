import { describe, expect, it } from 'bun:test';
import { injectOwnerConstant } from './injectOwnerConstant.ts';

describe('injectOwnerConstant', () => {
  it('prepends the constant to a plain module', () => {
    const out = injectOwnerConstant(`export const x = 1;\n`, 'Billing');
    expect(out.startsWith('const __OWNER__ = "Billing";\n')).toBe(true);
  });

  it('uses JSON.stringify so quotes/backslashes are escaped', () => {
    const out = injectOwnerConstant(`export const x = 1;\n`, 'name "with" quotes');
    expect(out).toContain('const __OWNER__ = "name \\"with\\" quotes";');
  });

  it('preserves "use strict" directive at the top of the file', () => {
    const source = `"use strict";\nexport const x = 1;\n`;
    const out = injectOwnerConstant(source, 'Identity');
    expect(out.startsWith('"use strict";')).toBe(true);
    expect(out).toContain('const __OWNER__ = "Identity";');
  });

  it('preserves "use client" directive at the top of the file', () => {
    const source = `"use client";\nexport const x = 1;\n`;
    const out = injectOwnerConstant(source, 'Platform');
    expect(out.startsWith('"use client";')).toBe(true);
  });
});
