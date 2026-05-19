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

export interface OwnershipAttentionFinding {
  readonly file: string;
  readonly status: Exclude<OwnershipAuditStatus, 'explicit'>;
  readonly message: string;
  readonly fixable: boolean;
}

export interface OwnershipTrace {
  readonly file: string;
  readonly explanation: string;
}

export interface OwnershipAuditReport {
  readonly files: readonly OwnershipAudit[];
  readonly resolved: readonly ResolvedOwnership[];
  readonly explicitFiles: readonly string[];
  readonly fallbackFiles: readonly string[];
  readonly unownedFiles: readonly string[];
  readonly invalidOwnerFiles: readonly string[];
  readonly needsAttentionFiles: readonly string[];
  readonly attentionFindings: readonly OwnershipAttentionFinding[];
  readonly total: number;
  readonly explicit: number;
  readonly fallback: number;
  readonly unowned: number;
  readonly invalidOwner: number;
  readonly needsAttention: number;
  readonly coveragePercent: number;
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

export function auditSourceFiles<TTeams extends Record<string, Team>>(
  config: OwnheimConfig<TTeams>,
  files: readonly AuditSourceFileInput[],
): OwnershipAuditReport {
  const audits = files.map((file) => auditSourceFile(config, file));
  return summarizeOwnershipAudits(audits);
}

export function summarizeOwnershipAudits(
  audits: readonly OwnershipAudit[],
): OwnershipAuditReport {
  const resolved: ResolvedOwnership[] = [];
  const explicitFiles: string[] = [];
  const fallbackFiles: string[] = [];
  const unownedFiles: string[] = [];
  const invalidOwnerFiles: string[] = [];
  const needsAttentionFiles: string[] = [];
  const attentionFindings: OwnershipAttentionFinding[] = [];

  for (const audit of audits) {
    if (audit.resolved !== undefined) resolved.push(audit.resolved);
    if (audit.needsAttention) {
      needsAttentionFiles.push(audit.file);
      attentionFindings.push(createAttentionFinding(audit));
    }

    if (audit.status === 'explicit') explicitFiles.push(audit.file);
    else if (audit.status === 'fallback') fallbackFiles.push(audit.file);
    else if (audit.status === 'invalid-jsdoc-owner') invalidOwnerFiles.push(audit.file);
    else unownedFiles.push(audit.file);
  }

  const total = audits.length;
  const explicit = explicitFiles.length;

  return {
    files: audits,
    resolved,
    explicitFiles,
    fallbackFiles,
    unownedFiles,
    invalidOwnerFiles,
    needsAttentionFiles,
    attentionFindings,
    total,
    explicit,
    fallback: fallbackFiles.length,
    unowned: unownedFiles.length,
    invalidOwner: invalidOwnerFiles.length,
    needsAttention: needsAttentionFiles.length,
    coveragePercent: total === 0 ? 100 : Math.round((explicit / total) * 1000) / 10,
  };
}

export function explainOwnershipAudit(audit: OwnershipAudit): OwnershipTrace {
  if (audit.status === 'invalid-jsdoc-owner') {
    return {
      file: audit.file,
      explanation: `${audit.file} -> INVALID @owner '${audit.jsdocOwner}' (team not found in ownheim.config.ts)`,
    };
  }
  if (audit.resolved === undefined) {
    return {
      file: audit.file,
      explanation: `${audit.file} -> UNOWNED (no rule matched and no fallback)`,
    };
  }
  if (audit.resolved.source === 'jsdoc') {
    return {
      file: audit.file,
      explanation: `${audit.file} -> ${audit.resolved.teams.join(', ')} (via @owner JSDoc)`,
    };
  }
  if (audit.resolved.source === 'fallback') {
    return {
      file: audit.file,
      explanation: `${audit.file} -> ${audit.resolved.teams.join(', ')} (FALLBACK '${audit.resolved.matchedGlob}')`,
    };
  }
  const jsdocNote = audit.jsdocOwner ? ` (jsdoc '@owner ${audit.jsdocOwner}' was unknown, ignored)` : '';
  return {
    file: audit.file,
    explanation: `${audit.file} -> ${audit.resolved.teams.join(', ')} (rule '${audit.resolved.matchedGlob}')${jsdocNote}`,
  };
}

export function createAttentionFinding(audit: OwnershipAudit): OwnershipAttentionFinding {
  if (audit.status === 'invalid-jsdoc-owner') {
    return {
      file: audit.file,
      status: audit.status,
      fixable: false,
      message: `${audit.file} references unknown owner '${audit.jsdocOwner}' in /** @owner ${audit.jsdocOwner} */. Use a team from ownheim.config.ts.`,
    };
  }
  if (audit.status === 'fallback') {
    return {
      file: audit.file,
      status: audit.status,
      fixable: true,
      message: `${audit.file} only matches the fallback rule (${audit.resolved?.matchedGlob ?? '**'}). Add a directory rule for this path or annotate the file with /** @owner <Team> */.`,
    };
  }
  return {
    file: audit.file,
    status: 'unowned',
    fixable: true,
    message: `${audit.file} has no owner: no rule matched and no fallback is configured. Add a directory rule to ownheim.config.ts or annotate the file with /** @owner <Team> */.`,
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
