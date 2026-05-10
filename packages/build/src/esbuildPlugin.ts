import { readFile } from 'node:fs/promises';
import { extname, relative } from 'node:path';
import type { Plugin } from 'esbuild';
import type { Team, StraysConfig } from '@strays/core/types';
import { analyzeSourceFile } from './analyzeSourceFile.ts';
import { resolveOwnerForFile } from './resolveRules.ts';

export interface StraysPluginOptions<TTeams extends Record<string, Team>> {
  readonly config: StraysConfig<TTeams>;
  readonly projectRoot: string;
  readonly extensions?: readonly string[];
}

const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts'] as const;

export function strays<TTeams extends Record<string, Team>>(
  options: StraysPluginOptions<TTeams>,
): Plugin {
  const extensions = options.extensions ?? DEFAULT_EXTENSIONS;

  return {
    name: '@strays/build',
    setup(build) {
      build.onLoad({ filter: /.*/ }, async (args) => {
        if (!extensions.includes(extname(args.path))) return undefined;

        const source = await readFile(args.path, 'utf8');
        const relativePath = relative(options.projectRoot, args.path).replace(/\\/g, '/');

        const analyzed = analyzeSourceFile(relativePath, source);
        const resolved = resolveOwnerForFile(options.config, {
          filePath: relativePath,
          jsdocOwner: analyzed.jsdocOwner,
        });

        if (!resolved) return undefined;

        return {
          contents: analyzed.transform(resolved.teams[0] ?? ''),
          loader: pickLoader(args.path),
        };
      });
    },
  };
}

function pickLoader(path: string): 'ts' | 'tsx' | 'js' | 'jsx' {
  if (path.endsWith('.tsx')) return 'tsx';
  if (path.endsWith('.jsx')) return 'jsx';
  if (path.endsWith('.ts') || path.endsWith('.mts') || path.endsWith('.cts')) return 'ts';
  return 'js';
}
