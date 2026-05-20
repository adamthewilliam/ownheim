import type { SourceFile } from 'ts-morph';
import type { SourceAnalysisFinding } from './sourceAnalysisTypes.ts';
import { isRuntimeSpecifier } from './runtimeSpecifier.ts';

export function extractSourceAnalysisFindings(sourceFile: SourceFile): SourceAnalysisFinding[] {
  return [
    ...findNamespaceRuntimeImports(sourceFile),
    ...findRuntimeReExports(sourceFile),
  ];
}

function findNamespaceRuntimeImports(sourceFile: SourceFile): SourceAnalysisFinding[] {
  const findings: SourceAnalysisFinding[] = [];

  for (const decl of sourceFile.getImportDeclarations()) {
    if (!isRuntimeSpecifier(decl.getModuleSpecifierValue())) continue;
    if (decl.isTypeOnly()) continue;
    if (!decl.getNamespaceImport()) continue;

    findings.push({
      code: 'namespace-runtime-import',
      message:
        'Namespace imports from @ownheim/core do not receive file-owner injection. Use named imports for runtime factories.',
      line: decl.getStartLineNumber(),
    });
  }

  return findings;
}

function findRuntimeReExports(sourceFile: SourceFile): SourceAnalysisFinding[] {
  const findings: SourceAnalysisFinding[] = [];

  for (const decl of sourceFile.getExportDeclarations()) {
    if (!isRuntimeSpecifier(decl.getModuleSpecifierValue())) continue;
    if (decl.isTypeOnly()) continue;

    findings.push({
      code: 'runtime-re-export',
      message:
        'Re-exports from @ownheim/core do not receive file-owner injection. Export owner-bound values from a local module instead.',
      line: decl.getStartLineNumber(),
    });
  }

  return findings;
}
