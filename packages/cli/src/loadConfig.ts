import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Owner, StraysConfig } from '@strays/core/types';

export interface LoadedConfig {
  readonly config: StraysConfig<Record<string, Owner>>;
  readonly path: string;
  readonly projectRoot: string;
}

const DEFAULT_FILENAMES = ['strays.config.ts', 'strays.config.js', 'strays.config.mjs'];

export async function loadConfig(projectRoot: string): Promise<LoadedConfig> {
  for (const filename of DEFAULT_FILENAMES) {
    const path = resolve(projectRoot, filename);
    if (existsSync(path)) {
      const mod = await import(path);
      const config = (mod.default ?? mod) as StraysConfig<Record<string, Owner>>;
      return { config, path, projectRoot };
    }
  }

  throw new Error(
    `No strays config found in ${projectRoot}. Create a strays.config.ts at the project root.`,
  );
}
