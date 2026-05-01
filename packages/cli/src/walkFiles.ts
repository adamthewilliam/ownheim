import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts'];
const DEFAULT_IGNORE = new Set(['node_modules', '.git', '.jj', 'dist', 'build', 'coverage']);

export interface WalkOptions {
  readonly extensions?: readonly string[];
  readonly ignore?: ReadonlySet<string>;
}

export async function* walkSourceFiles(
  root: string,
  options: WalkOptions = {},
): AsyncIterable<{ absolute: string; relative: string; source: string }> {
  const extensions = options.extensions ?? DEFAULT_EXTENSIONS;
  const ignore = options.ignore ?? DEFAULT_IGNORE;

  for await (const absolute of walk(root, ignore)) {
    if (!extensions.some((e) => absolute.endsWith(e))) continue;
    const source = await readFile(absolute, 'utf8');
    yield {
      absolute,
      relative: relative(root, absolute).replace(/\\/g, '/'),
      source,
    };
  }
}

async function* walk(dir: string, ignore: ReadonlySet<string>): AsyncIterable<string> {
  const entries = await readdir(dir);
  for (const entry of entries) {
    if (ignore.has(entry)) continue;
    const path = join(dir, entry);
    const info = await stat(path);
    if (info.isDirectory()) {
      yield* walk(path, ignore);
    } else if (info.isFile()) {
      yield path;
    }
  }
}
