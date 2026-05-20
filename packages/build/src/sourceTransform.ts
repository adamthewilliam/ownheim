import { SyntaxKind, type SourceFile } from 'ts-morph';

export function transformSourceFile(sourceFile: SourceFile, resolvedOwner: string): string {
  injectOwnerConstant(sourceFile, JSON.stringify(resolvedOwner));
  return sourceFile.getFullText();
}

function injectOwnerConstant(sourceFile: SourceFile, ownerLiteral: string): void {
  for (const stmt of sourceFile.getStatements()) {
    if (stmt.getKind() !== SyntaxKind.VariableStatement) continue;
    const text = stmt.getText();
    if (/^\s*(?:export\s+)?const\s+__OWNER__\s*=/.test(text)) return;
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
