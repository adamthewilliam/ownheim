import { describe, expect, it } from 'bun:test';
import type { Owner } from '@strays/core/types';
import { buildBundleFixture } from './buildBundleFixture.ts';

describe('buildBundleFixture (harness self-test)', () => {
  it('bundles a trivial entry and returns text containing the source literal', async () => {
    const owners: Record<string, Owner> = {
      Billing: { id: 'Billing', github: '@org/billing' },
    };

    const fixture = await buildBundleFixture({
      source: "export const hi = 'hello';\n",
      format: 'esm',
      // No rules match, so the strays plugin does not transform — exactly
      // what we want to prove the harness boots independently of the
      // transformer.
      config: { owners, rules: [] },
    });

    try {
      expect(fixture.text.length).toBeGreaterThan(0);
      expect(fixture.text).toContain('hello');
    } finally {
      await fixture.cleanup();
    }
  });
});
