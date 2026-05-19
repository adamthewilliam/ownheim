import { describe, expect, it } from 'bun:test';
import { readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { runCheck } from '@strays/cli/commands/check';
import { runCoverage } from '@strays/cli/commands/coverage';
import { runGenerate } from '@strays/cli/commands/generate';
import { runTrace } from '@strays/cli/commands/trace';
import straysConfig from './strays.config.ts';

const projectRoot = resolve(import.meta.dir);
const loaded = {
  config: straysConfig as unknown as Parameters<typeof runGenerate>[0]['config'],
  path: join(projectRoot, 'strays.config.ts'),
  projectRoot,
};

describe('bun-effect-http example end-to-end', () => {
  it('strays generate writes CODEOWNERS and manifest', async () => {
    await rm(join(projectRoot, '.github/CODEOWNERS'), { force: true });
    await rm(join(projectRoot, 'dist/strays-manifest.json'), { force: true });

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

  it('strays trace explains why src/billing/admin/refund.ts is Platform-owned', async () => {
    const result = await runTrace(loaded, 'src/billing/admin/refund.ts');
    expect(result.resolved?.teams).toEqual(['Platform']);
    expect(result.resolved?.matchedGlob).toBe('src/billing/admin/**');
    expect(result.explanation).toContain('Platform');
    expect(result.explanation).toContain('src/billing/admin/**');
  });

  it('strays trace identifies a fallback-only file as a stray', async () => {
    const result = await runTrace(loaded, 'src/start.ts');
    expect(result.resolved?.source).toBe('fallback');
    expect(result.explanation).toContain('FALLBACK');
  });

  it('strays coverage reports the example layout correctly', async () => {
    const result = await runCoverage(loaded);
    expect(result.total).toBeGreaterThanOrEqual(4);
    expect(result.unowned).toBe(0);
    expect(result.fallback).toBeGreaterThanOrEqual(1);
    expect(result.explicit).toBeGreaterThanOrEqual(3);
  });

  it('strays check passes after generate', async () => {
    await runGenerate(loaded);
    const result = await runCheck(loaded);
    expect(result.drift).toBe(false);
  });

  it('strays check detects drift after a hand-edit', async () => {
    await runGenerate(loaded);
    const codeownersPath = join(projectRoot, '.github/CODEOWNERS');
    const original = await readFile(codeownersPath, 'utf8');
    await Bun.write(codeownersPath, original + '\n# hand-added line\n');

    const result = await runCheck(loaded);
    expect(result.drift).toBe(true);

    await Bun.write(codeownersPath, original);
  });
});
