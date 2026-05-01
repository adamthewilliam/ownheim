import { readFile } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';
import { extractFromSourceText } from '@strays/build/extract';
import { resolveOwnerForFile } from '@strays/build/resolveRules';
import type { ResolvedOwner } from '@strays/core/types';
import type { LoadedConfig } from '../loadConfig.ts';

export interface TraceResult {
  readonly file: string;
  readonly resolved: ResolvedOwner | undefined;
  readonly jsdocOwner: string | undefined;
  readonly explanation: string;
}

export async function runTrace(loaded: LoadedConfig, filePath: string): Promise<TraceResult> {
  const absolute = isAbsolute(filePath) ? filePath : join(loaded.projectRoot, filePath);
  const rel = relative(loaded.projectRoot, absolute).replace(/\\/g, '/');
  const source = await readFile(absolute, 'utf8');

  const extraction = extractFromSourceText(rel, source);
  const resolved = resolveOwnerForFile(loaded.config, {
    filePath: rel,
    jsdocOwner: extraction.jsdocOwner,
  });

  return {
    file: rel,
    resolved,
    jsdocOwner: extraction.jsdocOwner,
    explanation: explain(rel, extraction.jsdocOwner, resolved),
  };
}

function explain(
  file: string,
  jsdocOwner: string | undefined,
  resolved: ResolvedOwner | undefined,
): string {
  if (resolved === undefined) {
    return `${file} -> UNOWNED (no rule matched and no fallback)`;
  }
  if (resolved.source === 'jsdoc') {
    return `${file} -> ${resolved.owners.join(', ')} (via @owner JSDoc)`;
  }
  if (resolved.source === 'fallback') {
    return `${file} -> ${resolved.owners.join(', ')} (FALLBACK '${resolved.matchedGlob}')`;
  }
  const jsdocNote = jsdocOwner ? ` (jsdoc '@owner ${jsdocOwner}' was unknown, ignored)` : '';
  return `${file} -> ${resolved.owners.join(', ')} (rule '${resolved.matchedGlob}')${jsdocNote}`;
}
