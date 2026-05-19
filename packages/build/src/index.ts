export { analyzeSourceFile, createSourceAnalyzer, extractFromSourceText } from './analyzeSourceFile.ts';
export type { AnalyzedFile, FileExtraction, SourceAnalyzer, SourceAnalysisFinding, SourceAnalysisFindingCode } from './analyzeSourceFile.ts';
export { auditSourceFile, auditSourceFiles, summarizeOwnershipAudits } from './auditOwnership.ts';
export type { OwnershipAudit, OwnershipAuditReport, OwnershipAuditStatus, AuditSourceFileInput } from './auditOwnership.ts';
export { createOwnershipResolver, resolveOwnerForFile, resolveAll } from './resolveRules.ts';
export type { ResolveInput } from './resolveRules.ts';
export { generateCodeowners } from './generateCodeowners.ts';
export { generateManifest } from './generateManifest.ts';
export {
  compareGeneratedText,
  defaultOwnershipArtifactPaths,
  generateOwnershipArtifacts,
  planOwnershipArtifacts,
} from './generateArtifacts.ts';
export type {
  ArtifactDrift,
  GeneratedOwnershipArtifacts,
  GenerateOwnershipArtifactsInput,
  OwnershipArtifactPathOptions,
  OwnershipArtifactPaths,
  OwnershipArtifactPlan,
} from './generateArtifacts.ts';
export { ownheim } from './esbuildPlugin.ts';
export type { OwnheimPluginOptions } from './esbuildPlugin.ts';
