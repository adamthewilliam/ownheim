import { readFile } from 'node:fs/promises';
import { extname, relative } from 'node:path';
import type { Plugin } from 'esbuild';
import type { Owner, StraysConfig } from '@strays/core/types';
import { injectOwnerConstant } from './injectOwnerConstant.ts';
import { transformLoggerImports } from './transformLoggerImports.ts';
import { extractFromSourceText } from './extract.ts';
import { resolveOwnerForFile } from './resolveRules.ts';

export interface StraysPluginOptions<TOwners extends Record<string, Owner>> {
  readonly config: StraysConfig<TOwners>;
  readonly projectRoot: string;
  readonly extensions?: readonly string[];
}

const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts'];

export function strays<TOwners extends Record<string, Owner>>(
  options: StraysPluginOptions<TOwners>,
): Plugin {
  const extensions = options.extensions ?? DEFAULT_EXTENSIONS;

  return {
    name: '@strays/build',
    setup(build) {
      build.onLoad({ filter: /.*/ }, async (args) => {
        if (!extensions.includes(extname(args.path))) return undefined;

        const source = await readFile(args.path, 'utf8');
        const relativePath = relative(options.projectRoot, args.path).replace(/\\/g, '/');

        const extraction = extractFromSourceText(relativePath, source);
        const resolved = resolveOwnerForFile(options.config, {
          filePath: relativePath,
          jsdocOwner: extraction.jsdocOwner,
        });

        if (!resolved) return undefined;

        const owner = resolved.owners[0] ?? '';
        let transformed = transformLoggerImports(source);
        transformed = injectOwnerConstant(transformed, owner);

        return {
          contents: transformed,
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
