export interface OwnedErrorConstruction {
  readonly className: string;
  readonly owner: string;
  readonly line: number;
}

export type SourceAnalysisFindingCode = 'namespace-runtime-import' | 'runtime-re-export';

export interface SourceAnalysisFinding {
  readonly code: SourceAnalysisFindingCode;
  readonly message: string;
  readonly line: number;
}

export interface FileExtraction {
  readonly filePath: string;
  readonly jsdocOwner: string | undefined;
  readonly ownedErrorConstructions: readonly OwnedErrorConstruction[];
  readonly findings: readonly SourceAnalysisFinding[];
}

export interface AnalyzedFile extends FileExtraction {
  /**
   * Produce the rewritten source text for this file, given the
   * caller-resolved owner string. Pure with respect to the parsed AST.
   * Calling this multiple times with different owners is well-defined.
   */
  readonly transform: (resolvedOwner: string) => string;
}
