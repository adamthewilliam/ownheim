import { describe, expect, it } from 'bun:test';
import { readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { runCheck } from '@ownheim/cli/commands/check';
import { runCoverage } from '@ownheim/cli/commands/coverage';
import { runGenerate } from '@ownheim/cli/commands/generate';
import ownheimConfig from './ownheim.config.ts';

const projectRoot = resolve(import.meta.dir);
const loaded = {
  config: ownheimConfig as unknown as Parameters<typeof runGenerate>[0]['config'],
  path: join(projectRoot, 'ownheim.config.ts'),
  projectRoot,
};

describe('turborepo-monorepo example end-to-end', () => {
  it('generates CODEOWNERS for packages and app routes', async () => {
    await rm(join(projectRoot, '.github/CODEOWNERS'), { force: true });
    await rm(join(projectRoot, 'dist/ownheim-manifest.json'), { force: true });

    const result = await runGenerate(loaded);
    const codeowners = await readFile(result.codeownersPath, 'utf8');

    expect(codeowners).toContain('/packages/core/ @acme/platform');
    expect(codeowners).toContain('/packages/checkout/ @acme/checkout');
    expect(codeowners).toContain('/packages/catalog/ @acme/catalog');
    expect(codeowners).toContain('/apps/storefront/src/routes/product-checkout/ @acme/catalog @acme/checkout');
    expect(codeowners).toContain('* @acme/platform');
  });

  it('reports full coverage with fallback for cross-cutting app files', async () => {
    const result = await runCoverage(loaded);

    expect(result.unowned).toBe(0);
    expect(result.explicit).toBeGreaterThanOrEqual(7);
    expect(result.fallback).toBeGreaterThanOrEqual(1);
  });

  it('passes drift check after generation', async () => {
    await runGenerate(loaded);
    const result = await runCheck(loaded);
    expect(result.drift).toBe(false);
  });
});
