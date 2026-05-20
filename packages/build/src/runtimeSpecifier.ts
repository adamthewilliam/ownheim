const RUNTIME_SPECIFIER = '@ownheim/core';

export function isRuntimeSpecifier(specifier: string | undefined): boolean {
  if (!specifier) return false;
  return specifier === RUNTIME_SPECIFIER || specifier.startsWith(`${RUNTIME_SPECIFIER}/`);
}
