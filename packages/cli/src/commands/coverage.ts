import { extractFromSourceText } from '@strays/build/extract';
import { resolveOwnerForFile } from '@strays/build/resolveRules';
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
    const extraction = extractFromSourceText(file.relative, file.source);
    const result = resolveOwnerForFile(loaded.config, {
      filePath: file.relative,
      jsdocOwner: extraction.jsdocOwner,
    });

    if (result === undefined) unownedFiles.push(file.relative);
    else if (result.source === 'fallback') fallbackFiles.push(file.relative);
    else explicit++;
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
