import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { compareGeneratedText, generateOwnershipArtifacts } from '@ownheim/build/generateArtifacts';
import { auditProjectOwnership } from '../auditProject.ts';
import type { LoadedConfig } from '../loadConfig.ts';

export interface CheckResult {
  readonly drift: boolean;
  readonly diff?: string;
  readonly ownheimCount: number;
  readonly ownheimFiles: readonly string[];
}

export async function runCheck(loaded: LoadedConfig): Promise<CheckResult> {
  const codeownersPath = join(loaded.projectRoot, '.github/CODEOWNERS');

  const audit = await auditProjectOwnership(loaded);
  const expected = generateOwnershipArtifacts({
    config: loaded.config,
    resolved: audit.resolved,
  }).codeownersText;
  let actual: string | undefined;
  try {
    actual = await readFile(codeownersPath, 'utf8');
  } catch {
    actual = undefined;
  }

  const drift = compareGeneratedText(actual, expected);
  return drift.drift
    ? {
        drift: true,
        ...(drift.diff === undefined ? {} : { diff: drift.diff }),
        ownheimCount: audit.needsAttention,
        ownheimFiles: audit.needsAttentionFiles,
      }
    : {
        drift: false,
        ownheimCount: audit.needsAttention,
        ownheimFiles: audit.needsAttentionFiles,
      };
}
