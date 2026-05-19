import { join } from 'node:path';
import type { OwnheimConfig, ResolvedOwnership, Team } from '@ownheim/core/types';
import { generateCodeowners } from './generateCodeowners.ts';
import { generateManifest, type ManifestOutput } from './generateManifest.ts';

export interface GeneratedOwnershipArtifacts {
  readonly codeownersText: string;
  readonly manifest: ManifestOutput;
  readonly manifestText: string;
}

export interface OwnershipArtifactPaths {
  readonly codeownersPath: string;
  readonly manifestPath: string;
}

export interface OwnershipArtifactPathOptions {
  readonly codeownersPath?: string;
  readonly manifestPath?: string;
}

export interface OwnershipArtifactPlan extends GeneratedOwnershipArtifacts, OwnershipArtifactPaths {}

export interface GenerateOwnershipArtifactsInput<TTeams extends Record<string, Team>> {
  readonly config: OwnheimConfig<TTeams>;
  readonly resolved: readonly ResolvedOwnership[];
}

export function defaultOwnershipArtifactPaths(
  projectRoot: string,
  options: OwnershipArtifactPathOptions = {},
): OwnershipArtifactPaths {
  return {
    codeownersPath: options.codeownersPath ?? join(projectRoot, '.github/CODEOWNERS'),
    manifestPath: options.manifestPath ?? join(projectRoot, 'dist/ownheim-manifest.json'),
  };
}

export function generateOwnershipArtifacts<TTeams extends Record<string, Team>>(
  input: GenerateOwnershipArtifactsInput<TTeams>,
): GeneratedOwnershipArtifacts {
  const manifest = generateManifest(input.resolved);
  return {
    codeownersText: generateCodeowners({ config: input.config, resolved: input.resolved }),
    manifest,
    manifestText: JSON.stringify(manifest, null, 2) + '\n',
  };
}

export function planOwnershipArtifacts<TTeams extends Record<string, Team>>(
  projectRoot: string,
  input: GenerateOwnershipArtifactsInput<TTeams>,
  options: OwnershipArtifactPathOptions = {},
): OwnershipArtifactPlan {
  return {
    ...defaultOwnershipArtifactPaths(projectRoot, options),
    ...generateOwnershipArtifacts(input),
  };
}

export interface ArtifactDrift {
  readonly drift: boolean;
  readonly diff?: string;
}

export function compareGeneratedText(actual: string | undefined, expected: string): ArtifactDrift {
  const drift = actual !== expected;
  return drift ? { drift, diff: simpleDiff(actual ?? '', expected) } : { drift };
}

function simpleDiff(actual: string, expected: string): string {
  const a = actual.split('\n');
  const e = expected.split('\n');
  const max = Math.max(a.length, e.length);
  const lines: string[] = [];
  for (let i = 0; i < max; i++) {
    if (a[i] !== e[i]) {
      if (a[i] !== undefined) lines.push(`- ${a[i]}`);
      if (e[i] !== undefined) lines.push(`+ ${e[i]}`);
    }
  }
  return lines.join('\n');
}
