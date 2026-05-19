import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { auditSourceFile } from '@ownheim/build/auditOwnership';
import { generateCodeowners } from '@ownheim/build/generateCodeowners';
import type { ResolvedOwner } from '@ownheim/core/types';
import type { LoadedConfig } from '../loadConfig.ts';
import { walkSourceFiles } from '../walkFiles.ts';

export interface CheckResult {
  readonly drift: boolean;
  readonly diff?: string;
  readonly ownheimCount: number;
  readonly ownheimFiles: readonly string[];
}

export async function runCheck(loaded: LoadedConfig): Promise<CheckResult> {
  const codeownersPath = join(loaded.projectRoot, '.github/CODEOWNERS');

  const resolved: ResolvedOwner[] = [];
  const ownheimFiles: string[] = [];

  for await (const file of walkSourceFiles(loaded.projectRoot)) {
    const audit = auditSourceFile(loaded.config, {
      filePath: file.relative,
      sourceText: file.source,
    });
    if (audit.needsAttention) {
      ownheimFiles.push(file.relative);
    }
    if (audit.resolved !== undefined) {
      resolved.push(audit.resolved);
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
    ? { drift, diff: simpleDiff(actual ?? '', expected), ownheimCount: ownheimFiles.length, ownheimFiles }
    : { drift, ownheimCount: ownheimFiles.length, ownheimFiles };
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
