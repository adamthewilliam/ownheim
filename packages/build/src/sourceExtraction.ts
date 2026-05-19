import { SyntaxKind, type SourceFile, type ts } from 'ts-morph';
import type { FileExtraction, OwnedErrorConstruction, SourceAnalysisFinding } from './sourceAnalysisTypes.ts';

const RUNTIME_SPECIFIER = '@ownheim/core';
const OWNER_TAG_REGEX = /@owner\s+([A-Za-z_][\w-]*)/;

export function extractFromParsedSourceFile(sourceFile: SourceFile): FileExtraction {
  return {
    filePath: sourceFile.getFilePath(),
    jsdocOwner: extractFileLevelOwner(sourceFile),
    ownedErrorConstructions: extractOwnedErrorConstructions(sourceFile),
    findings: extractSourceAnalysisFindings(sourceFile),
  };
}

function extractFileLevelOwner(sourceFile: SourceFile): string | undefined {
  const fullText = sourceFile.getFullText();
  const leadingTrivia = fullText.slice(0, firstNonCommentIndex(fullText));
  const match = leadingTrivia.match(OWNER_TAG_REGEX);
  return match?.[1];
}

function firstNonCommentIndex(text: string): number {
  let i = 0;
  while (i < text.length) {
    if (text.startsWith('//', i)) {
      const end = text.indexOf('\n', i);
      i = end === -1 ? text.length : end + 1;
      continue;
    }
    if (text.startsWith('/*', i)) {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 2;
      continue;
    }
    if (text[i] === ' ' || text[i] === '\t' || text[i] === '\n' || text[i] === '\r') {
      i++;
      continue;
    }
    break;
  }
  return i;
}

function extractOwnedErrorConstructions(sourceFile: SourceFile): OwnedErrorConstruction[] {
  const results: OwnedErrorConstruction[] = [];

  for (const cls of sourceFile.getClasses()) {
    const heritage = cls.getExtends();
    const baseName = heritage?.getExpression().getText();
    if (baseName !== 'OwnedError') continue;

    const className = cls.getName() ?? '<anonymous>';
    const ctor = cls.getConstructors()[0];
    if (!ctor) continue;

    const superCall = ctor
      .getBody()
      ?.getDescendantsOfKind(SyntaxKind.CallExpression)
      .find((c) => c.getExpression().getKind() === SyntaxKind.SuperKeyword);

    const ownerArg = superCall?.getArguments()[1];
    const owner = readStringLiteral(ownerArg as ts.Node | undefined);
    if (owner !== undefined) {
      results.push({ className, owner, line: cls.getStartLineNumber() });
    }
  }

  return results;
}

function extractSourceAnalysisFindings(sourceFile: SourceFile): SourceAnalysisFinding[] {
  const findings: SourceAnalysisFinding[] = [];

  for (const decl of sourceFile.getImportDeclarations()) {
    if (!isRuntimeSpecifier(decl.getModuleSpecifierValue())) continue;
    if (decl.isTypeOnly()) continue;
    if (decl.getNamespaceImport()) {
      findings.push({
        code: 'namespace-runtime-import',
        message:
          'Namespace imports from @ownheim/core are not rewritten by the Ownheim source transform. Use named imports for runtime factories.',
        line: decl.getStartLineNumber(),
      });
    }
  }

  for (const decl of sourceFile.getExportDeclarations()) {
    if (!isRuntimeSpecifier(decl.getModuleSpecifierValue())) continue;
    if (decl.isTypeOnly()) continue;
    findings.push({
      code: 'runtime-re-export',
      message:
        'Re-exports from @ownheim/core are not rewritten by the Ownheim source transform. Export factory-bound values from a local module instead.',
      line: decl.getStartLineNumber(),
    });
  }

  return findings;
}

function readStringLiteral(node: ts.Node | undefined): string | undefined {
  if (!node) return undefined;
  const text = (node as { getText?: () => string }).getText?.();
  if (!text) return undefined;
  if (
    (text.startsWith("'") && text.endsWith("'")) ||
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith('`') && text.endsWith('`'))
  ) {
    return text.slice(1, -1);
  }
  return undefined;
}

function isRuntimeSpecifier(spec: string | undefined): boolean {
  if (!spec) return false;
  if (spec === RUNTIME_SPECIFIER) return true;
  return spec.startsWith(`${RUNTIME_SPECIFIER}/`);
}
