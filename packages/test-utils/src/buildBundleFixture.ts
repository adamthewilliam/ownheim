import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { build, type BuildOptions, type Plugin } from 'esbuild';
import type { Team, StraysConfig } from '@strays/core/types';
import { strays } from '@strays/build/esbuildPlugin';

export interface BundleFixtureOptions<TTeams extends Record<string, Team>> {
  readonly source: string;
  readonly entryPath?: string;
  readonly extraFiles?: Record<string, string>;
  readonly format: 'esm' | 'cjs' | 'iife';
  readonly minify?: boolean;
  readonly treeShake?: boolean;
  readonly sourcemap?: boolean | 'inline' | 'external';
  readonly config: StraysConfig<TTeams>;
  readonly projectRoot?: string;
}

export interface BundleFixtureResult {
  readonly text: string;
  readonly sourcemap?: string;
  readonly cleanup: () => Promise<void>;
}

export async function buildBundleFixture<TTeams extends Record<string, Team>>(
  opts: BundleFixtureOptions<TTeams>,
): Promise<BundleFixtureResult> {
  // Always allocate a fresh tmp dir per call so concurrent fixtures do not
  // step on each other. The strays plugin reads files off disk inside its
  // `onLoad` hook, so we cannot use esbuild's virtual stdin path.
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'strays-fixture-'));
  const projectRoot = opts.projectRoot ?? fixtureRoot;
  const entryRelative = opts.entryPath ?? 'src/entry.ts';

  await writeVirtualFile(fixtureRoot, entryRelative, opts.source);

  if (opts.extraFiles) {
    for (const [path, contents] of Object.entries(opts.extraFiles)) {
      await writeVirtualFile(fixtureRoot, path, contents);
    }
  }

  const entryAbs = resolve(fixtureRoot, entryRelative);
  const plugin: Plugin = strays({ config: opts.config, projectRoot });

  const buildOptions: BuildOptions = {
    entryPoints: [entryAbs],
    bundle: true,
    write: false,
    format: opts.format,
    platform: opts.format === 'cjs' ? 'node' : 'neutral',
    absWorkingDir: projectRoot,
    plugins: [plugin],
    ...(opts.minify === undefined ? {} : { minify: opts.minify }),
    ...(opts.treeShake === undefined ? {} : { treeShaking: opts.treeShake }),
    ...(opts.sourcemap === undefined ? {} : { sourcemap: opts.sourcemap }),
  };

  let text = '';
  let sourcemap: string | undefined;
  try {
    const result = await build(buildOptions);
    const outputs = result.outputFiles ?? [];
    const jsOutput = outputs.find((f) => !f.path.endsWith('.map'));
    if (!jsOutput) {
      throw new Error('buildBundleFixture: esbuild produced no JS output file');
    }
    text = jsOutput.text;

    if (opts.sourcemap === 'external') {
      const mapOutput = outputs.find((f) => f.path.endsWith('.map'));
      if (mapOutput) sourcemap = mapOutput.text;
    }
  } catch (err) {
    await rm(fixtureRoot, { recursive: true, force: true });
    throw err;
  }

  return {
    text,
    ...(sourcemap === undefined ? {} : { sourcemap }),
    cleanup: async () => {
      await rm(fixtureRoot, { recursive: true, force: true });
    },
  };
}

async function writeVirtualFile(
  root: string,
  relativePath: string,
  contents: string,
): Promise<void> {
  const abs = resolve(root, relativePath);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, contents, 'utf8');
}
