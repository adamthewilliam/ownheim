import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Owner, OwnheimConfig } from '@ownheim/core/types';

export interface LoadedConfig {
  readonly config: OwnheimConfig<Record<string, Owner>>;
  readonly path: string;
  readonly projectRoot: string;
}

const DEFAULT_FILENAMES = ['ownheim.config.ts', 'ownheim.config.js', 'ownheim.config.mjs'];

export async function loadConfig(projectRoot: string): Promise<LoadedConfig> {
  for (const filename of DEFAULT_FILENAMES) {
    const path = resolve(projectRoot, filename);
    if (existsSync(path)) {
      const mod = await import(path);
      const config = (mod.default ?? mod) as OwnheimConfig<Record<string, Owner>>;
      return { config, path, projectRoot };
    }
  }

  throw new Error(
    `No ownheim config found in ${projectRoot}. Create a ownheim.config.ts at the project root.`,
  );
}
