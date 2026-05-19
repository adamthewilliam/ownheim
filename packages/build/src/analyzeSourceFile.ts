// RFC 0006 — unified per-file owner-aware preprocessing.
//
// One ts-morph parse per file. The same parsed `SourceFile` is reused for
// (a) the read-only extraction (jsdoc owner + OwnedError super calls) and
// (b) the transform pass (`@ownheim/core` import rewriting + `__OWNER__`
// constant injection).
//
// The external Source analysis module stays deliberately deep: callers choose
// read-only extraction or extraction + transform. Extraction and transform are
// internal seams so changes to @owner parsing, findings, or factory rewriting
// have locality without leaking more interface to callers.
import { Project, type SourceFile } from 'ts-morph';
import { extractFromParsedSourceFile } from './sourceExtraction.ts';
import { transformSourceFile } from './sourceTransform.ts';
import type { AnalyzedFile, FileExtraction } from './sourceAnalysisTypes.ts';

export type {
  AnalyzedFile,
  FileExtraction,
  OwnedErrorConstruction,
  SourceAnalysisFinding,
  SourceAnalysisFindingCode,
} from './sourceAnalysisTypes.ts';

/** Read-only path used by manifest + codeowners generators. */
export function extractFromSourceText(filePath: string, sourceText: string): FileExtraction {
  return createSourceAnalyzer().extract(filePath, sourceText);
}

/** Read + transform path used by the esbuild plugin. */
export function analyzeSourceFile(filePath: string, sourceText: string): AnalyzedFile {
  return createSourceAnalyzer().analyze(filePath, sourceText);
}

export interface SourceAnalyzer {
  extract(filePath: string, sourceText: string): FileExtraction;
  analyze(filePath: string, sourceText: string): AnalyzedFile;
}

/**
 * Reuses one in-memory ts-morph Project across a batch so audit/generate and
 * plugin flows do not pay Project construction cost for every source file.
 */
export function createSourceAnalyzer(): SourceAnalyzer {
  const project = new Project({ useInMemoryFileSystem: true });

  const parseAndExtract = (filePath: string, sourceText: string): ParsedAndExtracted => {
    const existing = project.getSourceFile(filePath);
    if (existing) project.removeSourceFile(existing);
    const sourceFile = project.createSourceFile(filePath, sourceText, { overwrite: true });
    return {
      sourceFile,
      extraction: extractFromParsedSourceFile(sourceFile),
    };
  };

  return {
    extract(filePath, sourceText) {
      return parseAndExtract(filePath, sourceText).extraction;
    },
    analyze(filePath, sourceText) {
      const { extraction, sourceFile } = parseAndExtract(filePath, sourceText);
      return {
        ...extraction,
        transform: (resolvedOwner: string) => transformSourceFile(sourceFile, resolvedOwner),
      };
    },
  };
}

interface ParsedAndExtracted {
  readonly extraction: FileExtraction;
  readonly sourceFile: SourceFile;
}
