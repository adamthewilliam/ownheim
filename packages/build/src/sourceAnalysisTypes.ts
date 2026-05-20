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
   * Produce source text with the caller-resolved owner injected as `__OWNER__`.
   * Pure with respect to the original source text: calling this multiple times
   * with different owners is well-defined.
   */
  readonly transform: (resolvedOwner: string) => string;
}
