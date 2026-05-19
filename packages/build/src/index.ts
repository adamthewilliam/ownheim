export { analyzeSourceFile } from './analyzeSourceFile.ts';
export { auditSourceFile } from './auditOwnership.ts';
export type { OwnershipAudit, OwnershipAuditStatus, AuditSourceFileInput } from './auditOwnership.ts';
export { resolveOwnerForFile, resolveAll } from './resolveRules.ts';
export type { ResolveInput } from './resolveRules.ts';
export { generateCodeowners } from './generateCodeowners.ts';
export { generateManifest } from './generateManifest.ts';
export { ownheim } from './esbuildPlugin.ts';
export type { OwnheimPluginOptions } from './esbuildPlugin.ts';
