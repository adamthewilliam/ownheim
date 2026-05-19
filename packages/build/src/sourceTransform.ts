import { SyntaxKind, type SourceFile } from 'ts-morph';

const RUNTIME_SPECIFIER = '@ownheim/core';

interface FactoryDescriptor {
  readonly fn: string;
  readonly modulePath: string;
}

const FACTORY_MAP: Record<string, FactoryDescriptor> = {
  logger: { fn: 'createLogger', modulePath: 'logging/createLogger' },
  tracer: { fn: 'createTracer', modulePath: 'tracing/createTracer' },
};

const FACTORY_MODULE_PATHS = new Set(Object.values(FACTORY_MAP).map((d) => d.modulePath));
const FACTORY_FN_NAMES = new Set(Object.values(FACTORY_MAP).map((d) => d.fn));

export function transformSourceFile(sourceFile: SourceFile, resolvedOwner: string): string {
  const ownerLiteral = JSON.stringify(resolvedOwner);
  const { bindings, factoriesSeen } = planFactoryBindings(sourceFile);

  injectOwnerConstant(sourceFile, ownerLiteral);

  if (bindings.length > 0) {
    addFactoryImports(sourceFile, factoriesSeen);
    addFactoryInitializers(sourceFile, bindings, ownerLiteral);
  }

  return sourceFile.getFullText();
}

interface FactoryBinding {
  readonly importedName: string;
  readonly localName: string;
}

function planFactoryBindings(sourceFile: SourceFile): {
  readonly bindings: FactoryBinding[];
  readonly factoriesSeen: Set<string>;
} {
  const bindings: FactoryBinding[] = [];
  const factoriesSeen = new Set<string>();

  for (const decl of sourceFile.getImportDeclarations()) {
    if (!isRuntimeSpecifier(decl.getModuleSpecifierValue())) continue;
    if (decl.isTypeOnly()) continue;
    if (decl.getNamespaceImport()) continue;

    for (const spec of decl.getNamedImports()) {
      if (spec.isTypeOnly()) continue;
      const importedName = spec.getName();
      if (!FACTORY_MAP[importedName]) continue;
      const aliasNode = spec.getAliasNode();
      const localName = aliasNode ? aliasNode.getText() : importedName;
      bindings.push({ importedName, localName });
      factoriesSeen.add(importedName);
      spec.remove();
    }

    if (
      decl.getNamedImports().length === 0 &&
      !decl.getNamespaceImport() &&
      !decl.getDefaultImport()
    ) {
      decl.remove();
    }
  }

  return { bindings, factoriesSeen };
}

function isRuntimeSpecifier(spec: string | undefined): boolean {
  if (!spec) return false;
  if (spec === RUNTIME_SPECIFIER) return true;
  return spec.startsWith(`${RUNTIME_SPECIFIER}/`);
}

function injectOwnerConstant(sourceFile: SourceFile, ownerLiteral: string): void {
  for (const stmt of sourceFile.getStatements()) {
    if (stmt.getKind() !== SyntaxKind.VariableStatement) continue;
    const text = stmt.getText();
    if (/^\s*(?:export\s+)?const\s+__OWNER__\s*=/.test(text)) return;
  }

  const insertIndex = directivePrologueEndIndex(sourceFile);
  sourceFile.insertStatements(insertIndex, `const __OWNER__ = ${ownerLiteral};`);
}

function addFactoryImports(sourceFile: SourceFile, factories: ReadonlySet<string>): void {
  const existingFactoryImports = new Set<string>();
  for (const decl of sourceFile.getImportDeclarations()) {
    const spec = decl.getModuleSpecifierValue();
    if (!spec.startsWith(`${RUNTIME_SPECIFIER}/`)) continue;
    const tail = spec.slice(RUNTIME_SPECIFIER.length + 1);
    if (FACTORY_MODULE_PATHS.has(tail)) {
      existingFactoryImports.add(tail);
    }
  }

  for (const importedName of factories) {
    const descriptor = FACTORY_MAP[importedName]!;
    if (existingFactoryImports.has(descriptor.modulePath)) continue;
    sourceFile.addImportDeclaration({
      moduleSpecifier: `${RUNTIME_SPECIFIER}/${descriptor.modulePath}`,
      namedImports: [descriptor.fn],
    });
  }
}

function addFactoryInitializers(
  sourceFile: SourceFile,
  bindings: ReadonlyArray<{ importedName: string; localName: string }>,
  ownerLiteral: string,
): void {
  const existingLocals = new Set<string>();
  for (const stmt of sourceFile.getStatements()) {
    if (stmt.getKind() !== SyntaxKind.VariableStatement) continue;
    const text = stmt.getText();
    const match = text.match(/^\s*(?:export\s+)?const\s+(\S+)\s*=\s*(\w+)\(/);
    if (match && FACTORY_FN_NAMES.has(match[2]!)) {
      existingLocals.add(match[1]!);
    }
  }

  const statements = sourceFile.getStatements();
  let insertIndex = directivePrologueEndIndex(sourceFile);
  for (let i = 0; i < statements.length; i++) {
    const s = statements[i]!;
    if (s.getKind() === SyntaxKind.ImportDeclaration) {
      insertIndex = i + 1;
    }
  }

  const newStatements = bindings
    .filter((b) => !existingLocals.has(b.localName))
    .map((b) => `const ${b.localName} = ${FACTORY_MAP[b.importedName]!.fn}(${ownerLiteral});`);

  if (newStatements.length > 0) {
    sourceFile.insertStatements(insertIndex, newStatements);
  }
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
