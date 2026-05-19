import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { extractFromSourceText } from '@ownheim/build/analyzeSourceFile';
import { generateCodeowners } from '@ownheim/build/generateCodeowners';
import { generateManifest } from '@ownheim/build/generateManifest';
import { resolveOwnerForFile } from '@ownheim/build/resolveRules';
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
    const extraction = extractFromSourceText(file.relative, file.source);
    const result = resolveOwnerForFile(loaded.config, {
      filePath: file.relative,
      jsdocOwner: extraction.jsdocOwner,
    });
    if (result === undefined || result.source === 'fallback') {
      ownheimCount++;
    }
    if (result !== undefined) {
      resolved.push(result);
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
