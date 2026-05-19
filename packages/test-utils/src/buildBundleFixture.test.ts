import { describe, expect, it } from 'bun:test';
import type { Team } from '@ownheim/core/types';
import { buildBundleFixture } from './buildBundleFixture.ts';

describe('buildBundleFixture (harness self-test)', () => {
  it('bundles a trivial entry and returns text containing the source literal', async () => {
    const teams: Record<string, Team> = {
      Billing: { github: '@org/billing' },
    };

    const fixture = await buildBundleFixture({
      source: "export const hi = 'hello';\n",
      format: 'esm',
      config: { teams },
    });

    try {
      expect(fixture.text.length).toBeGreaterThan(0);
      expect(fixture.text).toContain('hello');
    } finally {
      await fixture.cleanup();
    }
  });
});
