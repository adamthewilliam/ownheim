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

describe('bun-effect-http example end-to-end', () => {
  it('ownheim generate writes CODEOWNERS and manifest', async () => {
    await rm(join(projectRoot, '.github/CODEOWNERS'), { force: true });
    await rm(join(projectRoot, 'dist/ownheim-manifest.json'), { force: true });

    const result = await runGenerate(loaded);

    const codeowners = await readFile(result.codeownersPath, 'utf8');
    expect(codeowners).toContain('/src/billing/ @org/billing');
    expect(codeowners).toContain('/src/auth/ @org/identity');
    expect(codeowners).toContain('/src/billing/admin/ @org/platform');
    expect(codeowners).toContain('* @org/platform');

    const manifest = JSON.parse(await readFile(result.manifestPath, 'utf8')) as {
      version: number;
      files: Record<string, string>;
    };
    expect(manifest.version).toBe(1);
    expect(manifest.files['src/billing/charge.ts']).toBe('Billing');
    expect(manifest.files['src/auth/session.ts']).toBe('Identity');
    expect(manifest.files['src/billing/admin/refund.ts']).toBe('Platform');
  });

  it('ownheim coverage reports the example layout correctly', async () => {
    const result = await runCoverage(loaded);
    expect(result.total).toBeGreaterThanOrEqual(4);
    expect(result.unowned).toBe(0);
    expect(result.fallback).toBeGreaterThanOrEqual(1);
    expect(result.explicit).toBeGreaterThanOrEqual(3);
  });

  it('ownheim check passes after generate', async () => {
    await runGenerate(loaded);
    const result = await runCheck(loaded);
    expect(result.drift).toBe(false);
  });

  it('ownheim check detects drift after a hand-edit', async () => {
    await runGenerate(loaded);
    const codeownersPath = join(projectRoot, '.github/CODEOWNERS');
    const original = await readFile(codeownersPath, 'utf8');
    await Bun.write(codeownersPath, original + '\n# hand-added line\n');

    const result = await runCheck(loaded);
    expect(result.drift).toBe(true);

    await Bun.write(codeownersPath, original);
  });
});
