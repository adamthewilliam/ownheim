import { auditSourceFiles, type OwnershipAuditReport } from '@ownheim/build/auditOwnership';
import type { LoadedConfig } from './loadConfig.ts';
import { walkSourceFiles } from './walkFiles.ts';

export async function auditProjectOwnership(loaded: LoadedConfig): Promise<OwnershipAuditReport> {
  const files: Array<{ filePath: string; sourceText: string }> = [];

  for await (const file of walkSourceFiles(loaded.projectRoot)) {
    files.push({ filePath: file.relative, sourceText: file.source });
  }

  return auditSourceFiles(loaded.config, files);
}
