import { describe, expect, it } from 'bun:test';
import { generateManifest } from './generateManifest.ts';
import type { ResolvedOwnership } from '@strays/core/types';

describe('generateManifest', () => {
  it('produces version 1 manifest with file -> primary team mapping', () => {
    const resolved: ResolvedOwnership[] = [
      { file: 'src/billing/charge.ts', teams: ['Billing'], source: 'rule' },
      { file: 'src/auth/session.ts', teams: ['Identity'], source: 'rule' },
    ];

    const manifest = generateManifest(resolved);
    expect(manifest.version).toBe(1);
    expect(manifest.files).toEqual({
      'src/billing/charge.ts': 'Billing',
      'src/auth/session.ts': 'Identity',
    });
  });

  it('omits fallback-source files (they would mask coverage gaps)', () => {
    const resolved: ResolvedOwnership[] = [
      { file: 'src/billing/charge.ts', teams: ['Billing'], source: 'rule' },
      { file: 'tools/deploy.ts', teams: ['Platform'], source: 'fallback' },
    ];

    const manifest = generateManifest(resolved);
    expect(manifest.files).toEqual({ 'src/billing/charge.ts': 'Billing' });
  });

  it('uses the first team for shared rules', () => {
    const resolved: ResolvedOwnership[] = [
      { file: 'shared/util.ts', teams: ['Billing', 'Platform'], source: 'rule' },
    ];

    const manifest = generateManifest(resolved);
    expect(manifest.files['shared/util.ts']).toBe('Billing');
  });

  it('normalises Windows path separators to forward slashes', () => {
    const resolved: ResolvedOwnership[] = [
      { file: 'src\\billing\\charge.ts', teams: ['Billing'], source: 'rule' },
    ];

    const manifest = generateManifest(resolved);
    expect(manifest.files['src/billing/charge.ts']).toBe('Billing');
  });
});
