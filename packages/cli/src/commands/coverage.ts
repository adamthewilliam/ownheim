import { auditProjectOwnership } from '../auditProject.ts';
import type { LoadedConfig } from '../loadConfig.ts';

export interface CoverageResult {
  readonly total: number;
  readonly explicit: number;
  readonly fallback: number;
  readonly unowned: number;
  readonly percent: number;
  readonly fallbackFiles: readonly string[];
  readonly unownedFiles: readonly string[];
}

export async function runCoverage(loaded: LoadedConfig): Promise<CoverageResult> {
  const audit = await auditProjectOwnership(loaded);
  const unownedFiles = [...audit.unownedFiles, ...audit.invalidOwnerFiles];

  return {
    total: audit.total,
    explicit: audit.explicit,
    fallback: audit.fallback,
    unowned: audit.unowned + audit.invalidOwner,
    percent: audit.coveragePercent,
    fallbackFiles: audit.fallbackFiles,
    unownedFiles,
  };
}
