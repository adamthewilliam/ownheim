import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { planOwnershipArtifacts } from '@ownheim/build/generateArtifacts';
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
  const audit = await auditProjectOwnership(loaded);
  const resolved = audit.resolved as readonly ResolvedOwner[];
  const plan = planOwnershipArtifacts(
    loaded.projectRoot,
    { config: loaded.config, resolved: audit.resolved },
    options,
  );

  await mkdir(dirname(plan.codeownersPath), { recursive: true });
  await writeFile(plan.codeownersPath, plan.codeownersText, 'utf8');

  await mkdir(dirname(plan.manifestPath), { recursive: true });
  await writeFile(plan.manifestPath, plan.manifestText, 'utf8');

  return {
    resolved,
    codeownersText: plan.codeownersText,
    codeownersPath: plan.codeownersPath,
    manifestPath: plan.manifestPath,
    ownheimCount: audit.needsAttention,
  };
}
