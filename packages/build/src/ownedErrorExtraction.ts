import { Node, SyntaxKind, type SourceFile } from 'ts-morph';
import type { OwnedErrorConstruction } from './sourceAnalysisTypes.ts';

export function extractOwnedErrorConstructions(sourceFile: SourceFile): OwnedErrorConstruction[] {
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
      .find((call) => call.getExpression().getKind() === SyntaxKind.SuperKeyword);

    const owner = readStaticString(ctor ? superCall?.getArguments()[1] : undefined);
    if (owner !== undefined) {
      results.push({ className, owner, line: cls.getStartLineNumber() });
    }
  }

  return results;
}

function readStaticString(node: Node | undefined): string | undefined {
  if (!node) return undefined;
  if (Node.isStringLiteral(node)) return node.getLiteralText();
  if (Node.isNoSubstitutionTemplateLiteral(node)) return node.getLiteralText();
  return undefined;
}
