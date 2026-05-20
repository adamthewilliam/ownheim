import { Project, SyntaxKind, type SourceFile } from 'ts-morph';

/** Returns source text with a file-level __OWNER__ constant inserted after directive prologues. */
export function injectResolvedOwner(filePath: string, sourceText: string, resolvedOwner: string): string {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile(filePath, sourceText, { overwrite: true });
  injectOwnerConstant(sourceFile, JSON.stringify(resolvedOwner));
  return sourceFile.getFullText();
}

function injectOwnerConstant(sourceFile: SourceFile, ownerLiteral: string): void {
  for (const stmt of sourceFile.getStatements()) {
    if (stmt.getKind() !== SyntaxKind.VariableStatement) continue;
    const text = stmt.getText();
    if (/^\s*(?:export\s+)?const\s+__OWNER__\s*=/.test(text)) {
      stmt.replaceWithText(`const __OWNER__ = ${ownerLiteral};`);
      return;
    }
  }

  sourceFile.insertStatements(directivePrologueEndIndex(sourceFile), `const __OWNER__ = ${ownerLiteral};`);
}

function directivePrologueEndIndex(sourceFile: SourceFile): number {
  const statements = sourceFile.getStatements();
  let i = 0;
  for (; i < statements.length; i++) {
    const stmt = statements[i]!;
    if (stmt.getKind() !== SyntaxKind.ExpressionStatement) break;
    const expr = (stmt as { getExpression?: () => { getKind: () => SyntaxKind } | undefined })
      .getExpression?.();
    if (!expr) break;
    if (expr.getKind() !== SyntaxKind.StringLiteral) break;
  }
  return i;
}
