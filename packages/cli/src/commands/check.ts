import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { extractFromSourceText } from '@strays/build/extract';
import { generateCodeowners } from '@strays/build/generateCodeowners';
import { resolveOwnerForFile } from '@strays/build/resolveRules';
import type { ResolvedOwner } from '@strays/core/types';
import type { LoadedConfig } from '../loadConfig.ts';
import { walkSourceFiles } from '../walkFiles.ts';

export interface CheckResult {
  readonly drift: boolean;
  readonly diff?: string;
  readonly straysCount: number;
  readonly straysFiles: readonly string[];
}

export async function runCheck(loaded: LoadedConfig): Promise<CheckResult> {
  const codeownersPath = join(loaded.projectRoot, '.github/CODEOWNERS');

  const resolved: ResolvedOwner[] = [];
  const straysFiles: string[] = [];

  for await (const file of walkSourceFiles(loaded.projectRoot)) {
    const extraction = extractFromSourceText(file.relative, file.source);
    const result = resolveOwnerForFile(loaded.config, {
      filePath: file.relative,
      jsdocOwner: extraction.jsdocOwner,
    });
    if (result === undefined || result.source === 'fallback') {
      straysFiles.push(file.relative);
    }
    if (result !== undefined) {
      resolved.push(result);
    }
  }

  const expected = generateCodeowners({ config: loaded.config, resolved });
  let actual: string | undefined;
  try {
    actual = await readFile(codeownersPath, 'utf8');
  } catch {
    actual = undefined;
  }

  const drift = actual !== expected;
  const result: CheckResult = drift
    ? { drift, diff: simpleDiff(actual ?? '', expected), straysCount: straysFiles.length, straysFiles }
    : { drift, straysCount: straysFiles.length, straysFiles };
  return result;
}

function simpleDiff(actual: string, expected: string): string {
  const a = actual.split('\n');
  const e = expected.split('\n');
  const max = Math.max(a.length, e.length);
  const lines: string[] = [];
  for (let i = 0; i < max; i++) {
    if (a[i] !== e[i]) {
      if (a[i] !== undefined) lines.push(`- ${a[i]}`);
      if (e[i] !== undefined) lines.push(`+ ${e[i]}`);
    }
  }
  return lines.join('\n');
}
