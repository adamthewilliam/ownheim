import { readFile } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';
import { auditSourceFile, explainOwnershipAudit } from '@ownheim/build/auditOwnership';
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
    explanation: explainOwnershipAudit(audit).explanation,
  };
}
