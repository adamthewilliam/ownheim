import { readFile } from 'node:fs/promises';
import { compareGeneratedText, planOwnershipArtifacts } from '@ownheim/build/generateArtifacts';
import { auditProjectOwnership } from '../auditProject.ts';
import type { LoadedConfig } from '../loadConfig.ts';

export interface CheckResult {
  readonly drift: boolean;
  readonly diff?: string;
  readonly ownheimCount: number;
  readonly ownheimFiles: readonly string[];
}

export async function runCheck(loaded: LoadedConfig): Promise<CheckResult> {
  const audit = await auditProjectOwnership(loaded);
  const plan = planOwnershipArtifacts(loaded.projectRoot, {
    config: loaded.config,
    resolved: audit.resolved,
  });
  let actual: string | undefined;
  try {
    actual = await readFile(plan.codeownersPath, 'utf8');
  } catch {
    actual = undefined;
  }

  const drift = compareGeneratedText(actual, plan.codeownersText);
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
