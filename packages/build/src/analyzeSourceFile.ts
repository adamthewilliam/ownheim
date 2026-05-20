// Parses source files for ownership metadata and, for build-time callers,
// returns a pure owner-injection function for adding the resolved __OWNER__ constant.
import { Project } from 'ts-morph';
import { injectResolvedOwner } from './ownerInjection.ts';
import { extractFromParsedSourceFile } from './sourceExtraction.ts';
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
      extraction: extractFromParsedSourceFile(sourceFile),
    };
  };

  return {
    extract(filePath, sourceText) {
      return parseAndExtract(filePath, sourceText).extraction;
    },
    analyze(filePath, sourceText) {
      const { extraction } = parseAndExtract(filePath, sourceText);
      return {
        ...extraction,
        transform: (resolvedOwner: string) => injectResolvedOwner(filePath, sourceText, resolvedOwner),
      };
    },
  };
}

interface ParsedAndExtracted {
  readonly extraction: FileExtraction;
}
