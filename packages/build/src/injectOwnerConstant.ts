export function injectOwnerConstant(source: string, owner: string): string {
  const literal = JSON.stringify(owner);
  const directive = matchLeadingDirective(source);
  if (directive) {
    const insertAt = directive.endIndex;
    return `${source.slice(0, insertAt)}\nconst __OWNER__ = ${literal};${source.slice(insertAt)}`;
  }
  return `const __OWNER__ = ${literal};\n${source}`;
}

function matchLeadingDirective(source: string): { endIndex: number } | undefined {
  const match = source.match(/^(?:\s*(?:"use strict"|'use strict'|"use client"|'use client');?\s*)+/);
  if (match && match[0].length > 0) {
    return { endIndex: match[0].length };
  }
  return undefined;
}
