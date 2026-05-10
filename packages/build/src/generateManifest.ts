import type { ResolvedOwnership } from '@strays/core/types';

export interface ManifestOutput {
  readonly version: 1;
  readonly files: Record<string, string>;
}

export function generateManifest(resolved: readonly ResolvedOwnership[]): ManifestOutput {
  const files: Record<string, string> = {};
  for (const entry of resolved) {
    if (entry.source === 'fallback') continue;
    const primary = entry.teams[0];
    if (primary) files[normalise(entry.file)] = primary;
  }
  return { version: 1, files };
}

function normalise(path: string): string {
  return path.replace(/\\/g, '/');
}
