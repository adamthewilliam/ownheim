import type { SourceFile } from 'ts-morph';

const OWNER_TAG_REGEX = /@owner\s+([A-Za-z_][\w-]*)/;

export function extractFileLevelOwner(sourceFile: SourceFile): string | undefined {
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
