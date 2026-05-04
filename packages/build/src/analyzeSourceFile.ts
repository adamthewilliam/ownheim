// RFC 0006 — unified per-file owner-aware preprocessing.
//
// One ts-morph parse per file. The same parsed `SourceFile` is reused for
// (a) the read-only extraction (jsdoc owner + OwnedError super calls) and
// (b) the transform pass (`@strays/core` import rewriting + `__OWNER__`
// constant injection).
//
// Phase 1 scope (deliberately narrow — see RFC §3, §4):
//
//   - Namespace imports (`import * as ns from '@strays/core'`) are
//     left untouched. We do not yet rewrite `ns.logger` call sites; the
//     RFC accepts this as a Phase 2 follow-up rather than a regression
//     vs today, where the regex-based pass also failed silently.
//   - Re-exports (`export { logger } from '@strays/core'`) are left
//     untouched. The deferred design decision is whether to rewrite them
//     to a factory-binding shim or to reject them as a structured
//     diagnostic. Phase 1 preserves them verbatim so we don't introduce a
//     silent-corruption regression.
//
// Both edge cases are now structurally distinguishable thanks to the AST,
// so the follow-up implementations are localised changes inside this
// module — that's the deepening payoff.
import { Project, SyntaxKind, type SourceFile, type ts } from 'ts-morph';

const RUNTIME_SPECIFIER = '@strays/core';

/**
 * Map of factory-bound runtime exports → the factory function name and the
 * runtime subpath module that exports it.
 *
 * Lookups happen by identifier name on a parsed `ImportSpecifier`, so adding
 * a new factory is a one-line entry here. No regex, no per-export sub-path
 * allowlist.
 */
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

const OWNER_TAG_REGEX = /@owner\s+([A-Za-z_][\w-]*)/;

export interface OwnedErrorConstruction {
  readonly className: string;
  readonly owner: string;
  readonly line: number;
}

export interface FileExtraction {
  readonly filePath: string;
  readonly jsdocOwner: string | undefined;
  readonly ownedErrorConstructions: readonly OwnedErrorConstruction[];
}

export interface AnalyzedFile extends FileExtraction {
  /**
   * Produce the rewritten source text for this file, given the
   * caller-resolved owner string. Pure with respect to the parsed AST.
   * Calling this multiple times with different owners is well-defined.
   */
  readonly transform: (resolvedOwner: string) => string;
}

/** Read-only path used by manifest + codeowners generators. */
export function extractFromSourceText(filePath: string, sourceText: string): FileExtraction {
  const { extraction } = parseAndExtract(filePath, sourceText);
  return extraction;
}

/** Read + transform path used by the esbuild plugin. */
export function analyzeSourceFile(filePath: string, sourceText: string): AnalyzedFile {
  const { extraction, sourceFile } = parseAndExtract(filePath, sourceText);
  return {
    ...extraction,
    transform: (resolvedOwner: string) => transformSourceFile(sourceFile, resolvedOwner),
  };
}

interface ParsedAndExtracted {
  readonly extraction: FileExtraction;
  readonly sourceFile: SourceFile;
}

function parseAndExtract(filePath: string, sourceText: string): ParsedAndExtracted {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile(filePath, sourceText, { overwrite: true });
  return {
    sourceFile,
    extraction: {
      filePath: sourceFile.getFilePath(),
      jsdocOwner: extractFileLevelOwner(sourceFile),
      ownedErrorConstructions: extractOwnedErrorConstructions(sourceFile),
    },
  };
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------

function transformSourceFile(sourceFile: SourceFile, resolvedOwner: string): string {
  const ownerLiteral = JSON.stringify(resolvedOwner);

  // Collect factory-bound bindings from all `@strays/core[/sub]` imports.
  // Each binding becomes a `const <local> = createX(<owner literal>);`
  // initializer; we also add a sibling `import { createX } from
  // '@strays/core/<folder>/createX';` declaration for each unique factory.
  interface FactoryBinding {
    readonly importedName: string; // e.g. 'logger' (key in FACTORY_MAP)
    readonly localName: string; // e.g. 'logger' or 'log' (alias-aware)
  }
  const bindings: FactoryBinding[] = [];
  const factoriesSeen = new Set<string>();

  for (const decl of sourceFile.getImportDeclarations()) {
    if (!isRuntimeSpecifier(decl.getModuleSpecifierValue())) continue;
    if (decl.isTypeOnly()) continue; // type-only — leave alone (test 2)
    if (decl.getNamespaceImport()) continue; // Phase 1: leave namespace imports alone (test 3)

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

    // Drop the original declaration if it's now empty (no named, no
    // namespace, no default).
    if (
      decl.getNamedImports().length === 0 &&
      !decl.getNamespaceImport() &&
      !decl.getDefaultImport()
    ) {
      decl.remove();
    }
  }

  // If nothing factory-bound was found, we still need to honour the
  // __OWNER__ constant contract — but only inject it if the file already
  // declares `__OWNER__` (idempotency, test 12) is not present. The plugin
  // calls `transform` on every file regardless; we always inject so the
  // file has a stable owner contract for runtime-fallback paths and so
  // call sites that reference `__OWNER__` in user code resolve.
  //
  // Idempotency: if a `const __OWNER__ = ...;` already exists at the top
  // of the file, leave it alone instead of double-injecting.
  injectOwnerConstant(sourceFile, ownerLiteral);

  if (bindings.length > 0) {
    addFactoryImports(sourceFile, factoriesSeen);
    addFactoryInitializers(sourceFile, bindings, ownerLiteral);
  }

  return sourceFile.getFullText();
}

function isRuntimeSpecifier(spec: string | undefined): boolean {
  if (!spec) return false;
  if (spec === RUNTIME_SPECIFIER) return true;
  return spec.startsWith(`${RUNTIME_SPECIFIER}/`);
}

function injectOwnerConstant(sourceFile: SourceFile, ownerLiteral: string): void {
  // Skip if a top-level `const __OWNER__ = ...;` already exists (idempotency).
  for (const stmt of sourceFile.getStatements()) {
    if (stmt.getKind() !== SyntaxKind.VariableStatement) continue;
    const text = stmt.getText();
    if (/^\s*(?:export\s+)?const\s+__OWNER__\s*=/.test(text)) return;
  }

  const insertIndex = directivePrologueEndIndex(sourceFile);
  sourceFile.insertStatements(insertIndex, `const __OWNER__ = ${ownerLiteral};`);
}

function addFactoryImports(sourceFile: SourceFile, factories: ReadonlySet<string>): void {
  // Insert one `import { createX } from '@strays/core/<folder>/createX';`
  // per factory we encountered, skipping any factory whose import is already
  // present (idempotency, test 12).
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
  // Insert each `const <local> = <factory>(<ownerLiteral>);` after the
  // directive prologue + `__OWNER__` constant + any imports. Order is not
  // load-bearing for esbuild, but placing initializers after imports is
  // conventional and avoids hoisting hazards in user code that imports
  // and uses `logger` in the same file.
  //
  // Idempotency: if a top-level `const <local> = <factory>(...)` already
  // exists, skip it.
  const existingLocals = new Set<string>();
  for (const stmt of sourceFile.getStatements()) {
    if (stmt.getKind() !== SyntaxKind.VariableStatement) continue;
    const text = stmt.getText();
    const match = text.match(/^\s*(?:export\s+)?const\s+(\S+)\s*=\s*(\w+)\(/);
    if (match && FACTORY_FN_NAMES.has(match[2]!)) {
      existingLocals.add(match[1]!);
    }
  }

  // Insert position: just after the last import declaration (if any),
  // otherwise after the directive prologue.
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

/**
 * Returns the index in `sourceFile.getStatements()` where the directive
 * prologue ends — i.e. the first non-directive statement. Mirrors the
 * spec's "Directive Prologue" handling natively via the statement list,
 * with no regex required.
 */
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
