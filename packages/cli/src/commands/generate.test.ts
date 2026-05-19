import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineOwnheim } from '@ownheim/core/defineOwnheim';
import { runGenerate } from './generate.ts';

let scratchDirs: string[] = [];

afterEach(async () => {
  for (const dir of scratchDirs) await rm(dir, { recursive: true, force: true });
  scratchDirs = [];
});

async function makeScratch(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'ownheim-test-'));
  scratchDirs.push(dir);
  return dir;
}

describe('runGenerate (integration)', () => {
  it('writes CODEOWNERS + manifest and counts ownheim correctly', async () => {
    const root = await makeScratch();

    await mkdir(join(root, 'packages/billing'), { recursive: true });
    await mkdir(join(root, 'packages/auth'), { recursive: true });
    await mkdir(join(root, 'tools'), { recursive: true });

    await writeFile(join(root, 'packages/billing/charge.ts'), `export const x = 1;\n`);
    await writeFile(
      join(root, 'packages/billing/refund.ts'),
      `/** @owner Platform */\nexport const y = 2;\n`,
    );
    await writeFile(join(root, 'packages/auth/session.ts'), `export const z = 3;\n`);
    await writeFile(join(root, 'tools/deploy.ts'), `export const w = 4;\n`);

    const config = defineOwnheim({
      teams: {
        Billing: { github: '@org/billing', owns: ['packages/billing/**'] },
        Identity: { github: '@org/identity', owns: ['packages/auth/**'] },
        Platform: { github: '@org/platform' },
      },
    });

    const result = await runGenerate({
      config: config as unknown as Parameters<typeof runGenerate>[0]['config'],
      path: '',
      projectRoot: root,
    });

    const codeowners = await readFile(result.codeownersPath, 'utf8');
    expect(codeowners).toContain('/packages/billing/ @org/billing');
    expect(codeowners).toContain('/packages/auth/ @org/identity');
    expect(codeowners).toContain('/packages/billing/refund.ts @org/platform');

    const manifest = JSON.parse(await readFile(result.manifestPath, 'utf8')) as {
      version: number;
      files: Record<string, string>;
    };
    expect(manifest.version).toBe(1);
    expect(manifest.files['packages/billing/charge.ts']).toBe('Billing');
    expect(manifest.files['packages/billing/refund.ts']).toBe('Platform');
    expect(manifest.files['packages/auth/session.ts']).toBe('Identity');
    expect(manifest.files['tools/deploy.ts']).toBeUndefined();

    expect(result.ownheimCount).toBe(1);
  });
});
