import type { OwnheimConfig, ResolvedOwnership, Team } from '@ownheim/core/types';
import { extractFromSourceText, type FileExtraction } from './analyzeSourceFile.ts';
import { resolveOwnerForFile } from './resolveRules.ts';

export type OwnershipAuditStatus = 'explicit' | 'fallback' | 'unowned' | 'invalid-jsdoc-owner';

export interface OwnershipAudit {
  readonly file: string;
  readonly extraction: FileExtraction;
  readonly jsdocOwner: string | undefined;
  readonly resolved: ResolvedOwnership | undefined;
  readonly status: OwnershipAuditStatus;
  readonly isExplicit: boolean;
  readonly needsAttention: boolean;
}

export interface AuditSourceFileInput {
  readonly filePath: string;
  readonly sourceText: string;
}

export function auditSourceFile<TTeams extends Record<string, Team>>(
  config: OwnheimConfig<TTeams>,
  input: AuditSourceFileInput,
): OwnershipAudit {
  const extraction = extractFromSourceText(input.filePath, input.sourceText);
  const resolved = resolveOwnerForFile(config, {
    filePath: input.filePath,
    jsdocOwner: extraction.jsdocOwner,
  });

  const status = determineStatus(config, extraction.jsdocOwner, resolved);

  return {
    file: input.filePath,
    extraction,
    jsdocOwner: extraction.jsdocOwner,
    resolved,
    status,
    isExplicit: status === 'explicit',
    needsAttention: status !== 'explicit',
  };
}

function determineStatus<TTeams extends Record<string, Team>>(
  config: OwnheimConfig<TTeams>,
  jsdocOwner: string | undefined,
  resolved: ResolvedOwnership | undefined,
): OwnershipAuditStatus {
  if (jsdocOwner !== undefined && !(jsdocOwner in config.teams)) return 'invalid-jsdoc-owner';
  if (resolved === undefined) return 'unowned';
  if (resolved.source === 'fallback') return 'fallback';
  return 'explicit';
}
