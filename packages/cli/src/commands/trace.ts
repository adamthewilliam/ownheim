import { readFile } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';
import { auditSourceFile, type OwnershipAuditStatus } from '@ownheim/build/auditOwnership';
import type { ResolvedOwner } from '@ownheim/core/types';
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

  const audit = auditSourceFile(loaded.config, {
    filePath: rel,
    sourceText: source,
  });

  return {
    file: rel,
    resolved: audit.resolved,
    jsdocOwner: audit.jsdocOwner,
    explanation: explain(rel, audit.jsdocOwner, audit.resolved, audit.status),
  };
}

function explain(
  file: string,
  jsdocOwner: string | undefined,
  resolved: ResolvedOwner | undefined,
  status: OwnershipAuditStatus,
): string {
  if (status === 'invalid-jsdoc-owner') {
    return `${file} -> INVALID @owner '${jsdocOwner}' (team not found in ownheim.config.ts)`;
  }
  if (resolved === undefined) {
    return `${file} -> UNOWNED (no rule matched and no fallback)`;
  }
  if (resolved.source === 'jsdoc') {
    return `${file} -> ${resolved.teams.join(', ')} (via @owner JSDoc)`;
  }
  if (resolved.source === 'fallback') {
    return `${file} -> ${resolved.teams.join(', ')} (FALLBACK '${resolved.matchedGlob}')`;
  }
  const jsdocNote = jsdocOwner ? ` (jsdoc '@owner ${jsdocOwner}' was unknown, ignored)` : '';
  return `${file} -> ${resolved.teams.join(', ')} (rule '${resolved.matchedGlob}')${jsdocNote}`;
}
