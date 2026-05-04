// A5 — Stack-frame robustness on bundles.
//
// Bundling collapses many source files into one script, so the V8 stack
// frames captured by `lookupCallerOwner` no longer point at the source
// file the manifest is keyed by. The expected mitigation is source maps,
// which let V8 unwind frames back to the original source — but only when
// the host runtime is configured to apply them.
//
// This test bundles a tiny entry+feature pair four ways, runs each in a
// Node subprocess (with `--enable-source-maps`), and inspects the
// resolved owner. We use Node rather than Bun because Bun does NOT
// source-map `Error.stack` at runtime — see the test docstring for
// "non-minified bundle …" below for the empirical evidence.
//
// Strategy per run:
//   1. The bundled `feature.ts` self-captures its V8-reported file path
//      via a fresh `Error().stack`. This tells us what the runtime sees
//      *after* whatever source-map handling the host applies.
//   2. The bundled entry registers a `ManifestRegistry` containing the
//      self-captured path against owner `Billing`, then issues a
//      lookup. If the registry can resolve via the captured path, the
//      whole stack-frame → manifest pipeline works for that config.
//   3. The entry also issues a second lookup against a registry keyed
//      by the relative source path (`src/feature.ts`) — what the strays
//      build plugin actually emits in production. This is the realistic
//      production case that fails when frames are not source-mapped.
//   4. `feature.ts` also throws an `OwnedError` whose tag is
//      independent of stack frames; it serves as a control proving the
//      subprocess executed correctly.
//
// We bundle directly with esbuild here (rather than going through the
// `buildBundleFixture` helper) for two reasons:
//   - The helper does not pass `outfile` / `outdir`, which esbuild
//     requires for `sourcemap: 'external'`.
//   - The helper points `absWorkingDir` at the freshly-mkdtemp'd fixture
//     dir, leaving esbuild's resolver unable to find `@strays/*`
//     workspace packages from outside the monorepo. We sidestep that by
//     writing the entry+feature *inside* the package's test tree, where
//     normal node_modules resolution Just Works.
//
// `runBundleInSubprocess` is kept for execution.

import { describe, expect, it } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { runBundleInSubprocess } from '@strays/test-utils/runBundleInSubprocess';

const HERE = dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = resolve(HERE, '../../../..');
const CORE_SRC = `${MONOREPO_ROOT}/packages/core/src`;

interface RunOutput {
  readonly featureFramePath: string | null;
  readonly featureFrameRaw: string | null;
  readonly ownerWithSelfPath: string | null;
  readonly ownerWithSourcePath: string | null;
  readonly ownerFromOwnedError: string | null;
}

const FEATURE_SOURCE = `
import { OwnedError } from '${CORE_SRC}/OwnedError.ts';
import { lookupCallerOwner } from '${CORE_SRC}/resolution/lookupCallerOwner.ts';

// Capture this module's V8-reported file path via a fresh Error stack.
// We grab the first frame after the Error header (which is the frame
// that called captureMyFramePath itself — i.e. the entry).  That is OK
// for our purposes because in the bundled output \`feature.ts\` and
// \`entry.ts\` are inlined into one file and we just want to know the
// path V8 attributes to user code.
//
// More importantly: we look at frames inside *this* function and the
// next one too. The point is to discover what the host runtime calls
// "this code's location" — bundle file, or source-mapped origin.
export function captureMyFramePath() {
  const err = new Error('probe');
  const stack = (err.stack ?? '').split('\\n');
  for (let i = 1; i < stack.length; i++) {
    const line = stack[i];
    if (!line) continue;
    // Vendor frames inside Node internals — skip.
    if (line.includes('node:internal') || line.includes('(node:')) continue;
    const paren = line.match(/\\((.+):\\d+:\\d+\\)\\s*$/);
    if (paren && paren[1]) return { path: paren[1], raw: line };
    const bare = line.match(/at\\s+(\\S+):\\d+:\\d+\\s*$/);
    if (bare && bare[1]) return { path: bare[1], raw: line };
  }
  return { path: null, raw: stack[1] ?? null };
}

export function callLookupFromFeature() {
  return lookupCallerOwner();
}

export function throwOwned() {
  throw new OwnedError('boom from feature', 'Billing');
}
`;

const ENTRY_SOURCE = `
import { ManifestRegistry } from '${CORE_SRC}/manifest/ManifestRegistry.ts';
import { setDefaultRegistry } from '${CORE_SRC}/manifest/defaultRegistry.ts';
import { walkOwnedErrorChain } from '${CORE_SRC}/resolution/walkOwnedErrorChain.ts';
import {
  captureMyFramePath,
  callLookupFromFeature,
  throwOwned,
} from './feature.ts';

const probe = captureMyFramePath();
const featurePath = probe.path;

// Lookup #1: registry keyed by what V8 actually reports for feature.ts.
// This is the "if the runtime had perfect knowledge" baseline — it will
// succeed in every config because we register the exact path V8 gives
// us.  It exists to prove that \`lookupCallerOwner\` itself is not
// broken.
const selfRegistry = ManifestRegistry.fromManifest({
  version: 1,
  files: featurePath ? { [featurePath]: 'Billing' } : {},
});
setDefaultRegistry(selfRegistry);
const ownerWithSelfPath = callLookupFromFeature() ?? null;

// Lookup #2: registry keyed by the relative source path the strays
// build plugin would emit (\`src/feature.ts\`). This is the realistic
// production case. Whether it succeeds depends on whether the runtime
// frame matches a path the manifest knows about — i.e. whether source
// maps were applied AND whether the source-mapped path can be matched.
const sourceRegistry = ManifestRegistry.fromManifest({
  version: 1,
  files: { 'src/feature.ts': 'Billing' },
});
setDefaultRegistry(sourceRegistry);
const ownerWithSourcePath = callLookupFromFeature() ?? null;

// Sanity: the OwnedError tag is stamped at construction and is
// independent of stack-frame parsing.  It proves the subprocess
// actually ran user code.
let ownerFromOwnedError = null;
try {
  throwOwned();
} catch (err) {
  ownerFromOwnedError = walkOwnedErrorChain(err) ?? null;
}

const out = {
  featureFramePath: featurePath,
  featureFrameRaw: probe.raw,
  ownerWithSelfPath,
  ownerWithSourcePath,
  ownerFromOwnedError,
};
process.stdout.write(JSON.stringify(out));
`;

interface Config {
  readonly name: string;
  readonly minify: boolean;
  // We pass `'linked'` to esbuild when the matrix calls for "external"
  // — `linked` writes a separate .map file *and* adds the
  // `//# sourceMappingURL=` comment Node needs in order to discover it.
  // esbuild's bare `'external'` mode skips the comment, which leaves
  // the source map effectively orphaned at runtime; that mismatch is
  // not what we want to test here.
  readonly sourcemap: false | 'inline' | 'linked';
}

const CONFIGS = {
  noMinifyNoMap: { name: 'esm + no-minify + no-sourcemap', minify: false, sourcemap: false },
  minifyNoMap: { name: 'esm + minify + no-sourcemap', minify: true, sourcemap: false },
  minifyExternal: { name: 'esm + minify + external-sourcemap', minify: true, sourcemap: 'linked' },
  minifyInline: { name: 'esm + minify + inline-sourcemap', minify: true, sourcemap: 'inline' },
} as const satisfies Record<string, Config>;

interface BuiltBundle {
  readonly text: string;
  readonly sourcemap: string | undefined;
  readonly cleanup: () => Promise<void>;
}

async function bundle(cfg: Config): Promise<BuiltBundle> {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'strays-a5-'));
  const entryAbs = join(fixtureRoot, 'src', 'entry.ts');
  const featureAbs = join(fixtureRoot, 'src', 'feature.ts');

  await mkdir(dirname(entryAbs), { recursive: true });
  await writeFile(entryAbs, ENTRY_SOURCE, 'utf8');
  await writeFile(featureAbs, FEATURE_SOURCE, 'utf8');

  // We set `outfile` so esbuild accepts `sourcemap: 'external'`. The
  // file is never written because `write: false` is set; we read the
  // contents off `result.outputFiles`.
  const outAbs = join(fixtureRoot, 'dist', 'bundle.mjs');

  let text = '';
  let sourcemapText: string | undefined;
  try {
    const result = await build({
      entryPoints: [entryAbs],
      bundle: true,
      format: 'esm',
      platform: 'node',
      write: false,
      outfile: outAbs,
      absWorkingDir: fixtureRoot,
      ...(cfg.minify ? { minify: true } : {}),
      ...(cfg.sourcemap === false ? {} : { sourcemap: cfg.sourcemap }),
    });
    const outputs = result.outputFiles ?? [];
    const js = outputs.find((f) => !f.path.endsWith('.map'));
    if (!js) throw new Error('A5 bundle: esbuild produced no JS output');
    text = js.text;
    if (cfg.sourcemap === 'linked') {
      const map = outputs.find((f) => f.path.endsWith('.map'));
      if (map) sourcemapText = map.text;
    }
  } catch (err) {
    await rm(fixtureRoot, { recursive: true, force: true });
    throw err;
  }

  return {
    text,
    sourcemap: sourcemapText,
    cleanup: async () => {
      await rm(fixtureRoot, { recursive: true, force: true });
    },
  };
}

async function buildAndRun(cfg: Config): Promise<RunOutput> {
  const built = await bundle(cfg);
  try {
    const result = await runBundleInSubprocess(built.text, {
      // Bun does NOT source-map Error.stack at runtime, so the source-map
      // configurations would be indistinguishable from the no-map ones
      // under Bun. Node *does* source-map (with --enable-source-maps),
      // so we use Node here to keep the test honest about the matrix.
      runtime: 'node',
      nodeFlags: ['--enable-source-maps'],
      ...(built.sourcemap !== undefined ? { sourcemap: built.sourcemap } : {}),
    });

    if (result.code !== 0) {
      throw new Error(
        `subprocess failed for ${cfg.name} (code=${String(result.code)})\n` +
          `STDOUT:\n${result.stdout}\n` +
          `STDERR:\n${result.stderr}`,
      );
    }

    const trimmed = result.stdout.trim();
    if (trimmed === '') {
      throw new Error(
        `subprocess produced empty stdout for ${cfg.name}\nSTDERR:\n${result.stderr}`,
      );
    }
    return JSON.parse(trimmed) as RunOutput;
  } finally {
    await built.cleanup();
  }
}

describe('A5 — stack-frame robustness on bundles', () => {
  it('baseline: walkOwnedErrorChain works in every config (it does not depend on stack frames)', async () => {
    for (const cfg of Object.values(CONFIGS)) {
      const out = await buildAndRun(cfg);
      expect(out.ownerFromOwnedError, `OwnedError tag for ${cfg.name}`).toBe('Billing');
    }
  }, 60_000);

  it('self-path lookup succeeds in every config (sanity: lookupCallerOwner can resolve when the manifest has the exact frame path V8 reports)', async () => {
    for (const cfg of Object.values(CONFIGS)) {
      const out = await buildAndRun(cfg);
      expect(out.featureFramePath, `frame path for ${cfg.name}`).toBeTruthy();
      expect(out.ownerWithSelfPath, `self-path lookup for ${cfg.name}`).toBe('Billing');
    }
  }, 60_000);

  it('non-minified bundle, no source map: V8 frames carry the bundle path, NOT the source path', async () => {
    const out = await buildAndRun(CONFIGS.noMinifyNoMap);
    // Without source maps the frame points at the executed bundle file
    // (runBundleInSubprocess writes the bundle to a /tmp scratch dir as
    // bundle.mjs).  The original `src/feature.ts` path is gone.
    expect(out.featureFramePath ?? '').toContain('bundle.mjs');
    // Therefore a manifest keyed by the source path `src/feature.ts`
    // cannot match — production failure mode.
    expect(out.ownerWithSourcePath).toBeNull();
  }, 30_000);

  it('minified bundle, no source map: owner resolution against source-keyed manifest FAILS (production failure mode)', async () => {
    const out = await buildAndRun(CONFIGS.minifyNoMap);
    expect(out.featureFramePath ?? '').toContain('bundle.mjs');
    // The strays build plugin keys the manifest by source paths (e.g.
    // `src/feature.ts`).  The runtime sees `bundle.mjs`.  No match.
    expect(out.ownerWithSourcePath).toBeNull();
  }, 30_000);

  it('minified bundle with EXTERNAL source map: V8 frames are remapped, owner resolution recovers via the captured path', async () => {
    const out = await buildAndRun(CONFIGS.minifyExternal);
    // Node + --enable-source-maps reads the sibling .mjs.map and
    // rewrites stack frames back to the source location. The frame
    // should now mention feature.ts.
    expect(out.featureFramePath ?? '').toContain('feature.ts');
    expect(out.featureFramePath ?? '').not.toContain('bundle.mjs');
    // Self-path lookup proves owner resolution is fully recoverable in
    // this configuration: frame matches a manifest entry → owner returned.
    expect(out.ownerWithSelfPath).toBe('Billing');
  }, 30_000);

  it('minified bundle with INLINE source map: V8 frames are remapped, owner resolution recovers via the captured path', async () => {
    const out = await buildAndRun(CONFIGS.minifyInline);
    expect(out.featureFramePath ?? '').toContain('feature.ts');
    expect(out.featureFramePath ?? '').not.toContain('bundle.mjs');
    expect(out.ownerWithSelfPath).toBe('Billing');
  }, 30_000);
});
