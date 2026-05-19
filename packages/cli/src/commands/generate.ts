import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { auditSourceFile } from '@ownheim/build/auditOwnership';
import { generateCodeowners } from '@ownheim/build/generateCodeowners';
import { generateManifest } from '@ownheim/build/generateManifest';
import type { ResolvedOwner } from '@ownheim/core/types';
import type { LoadedConfig } from '../loadConfig.ts';
import { walkSourceFiles } from '../walkFiles.ts';

export interface GenerateOptions {
  readonly codeownersPath?: string;
  readonly manifestPath?: string;
}

export interface GenerateResult {
  readonly resolved: readonly ResolvedOwner[];
  readonly codeownersText: string;
  readonly codeownersPath: string;
  readonly manifestPath: string;
  readonly ownheimCount: number;
}

export async function runGenerate(
  loaded: LoadedConfig,
  options: GenerateOptions = {},
): Promise<GenerateResult> {
  const codeownersPath = options.codeownersPath ?? join(loaded.projectRoot, '.github/CODEOWNERS');
  const manifestPath = options.manifestPath ?? join(loaded.projectRoot, 'dist/ownheim-manifest.json');

  const resolved: ResolvedOwner[] = [];
  let ownheimCount = 0;

  for await (const file of walkSourceFiles(loaded.projectRoot)) {
    const audit = auditSourceFile(loaded.config, {
      filePath: file.relative,
      sourceText: file.source,
    });
    if (audit.needsAttention) {
      ownheimCount++;
    }
    if (audit.resolved !== undefined) {
      resolved.push(audit.resolved);
    }
  }

  const codeownersText = generateCodeowners({ config: loaded.config, resolved });
  const manifest = generateManifest(resolved);

  await mkdir(dirname(codeownersPath), { recursive: true });
  await writeFile(codeownersPath, codeownersText, 'utf8');

  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  return { resolved, codeownersText, codeownersPath, manifestPath, ownheimCount };
}
