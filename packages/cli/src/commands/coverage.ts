import { auditSourceFile } from '@ownheim/build/auditOwnership';
import type { LoadedConfig } from '../loadConfig.ts';
import { walkSourceFiles } from '../walkFiles.ts';

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
  let total = 0;
  let explicit = 0;
  const fallbackFiles: string[] = [];
  const unownedFiles: string[] = [];

  for await (const file of walkSourceFiles(loaded.projectRoot)) {
    total++;
    const audit = auditSourceFile(loaded.config, {
      filePath: file.relative,
      sourceText: file.source,
    });

    if (audit.status === 'unowned' || audit.status === 'invalid-jsdoc-owner') {
      unownedFiles.push(file.relative);
    } else if (audit.status === 'fallback') {
      fallbackFiles.push(file.relative);
    } else {
      explicit++;
    }
  }

  const percent = total === 0 ? 100 : Math.round((explicit / total) * 1000) / 10;

  return {
    total,
    explicit,
    fallback: fallbackFiles.length,
    unowned: unownedFiles.length,
    percent,
    fallbackFiles,
    unownedFiles,
  };
}
