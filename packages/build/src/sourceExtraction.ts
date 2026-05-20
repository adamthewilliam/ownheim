import type { SourceFile } from 'ts-morph';
import type { FileExtraction } from './sourceAnalysisTypes.ts';
import { extractFileLevelOwner } from './ownerTag.ts';
import { extractOwnedErrorConstructions } from './ownedErrorExtraction.ts';
import { extractSourceAnalysisFindings } from './sourceFindings.ts';

export function extractFromParsedSourceFile(sourceFile: SourceFile): FileExtraction {
  return {
    filePath: sourceFile.getFilePath(),
    jsdocOwner: extractFileLevelOwner(sourceFile),
    ownedErrorConstructions: extractOwnedErrorConstructions(sourceFile),
    findings: extractSourceAnalysisFindings(sourceFile),
  };
}
