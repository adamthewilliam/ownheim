import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { generateOwnershipArtifacts } from '@ownheim/build/generateArtifacts';
import type { ResolvedOwner } from '@ownheim/core/types';
import { auditProjectOwnership } from '../auditProject.ts';
import type { LoadedConfig } from '../loadConfig.ts';

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

  const audit = await auditProjectOwnership(loaded);
  const resolved = audit.resolved as readonly ResolvedOwner[];
  const artifacts = generateOwnershipArtifacts({ config: loaded.config, resolved: audit.resolved });

  await mkdir(dirname(codeownersPath), { recursive: true });
  await writeFile(codeownersPath, artifacts.codeownersText, 'utf8');

  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, artifacts.manifestText, 'utf8');

  return {
    resolved,
    codeownersText: artifacts.codeownersText,
    codeownersPath,
    manifestPath,
    ownheimCount: audit.needsAttention,
  };
}
