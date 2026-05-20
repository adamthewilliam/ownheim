// A3 — Dynamic import + TLA contract tests.
//
// Goal: assert that the @ownheim/build esbuild plugin's `__OWNER__`
// injection survives less-common module shapes:
//   1. dynamic `import()` of an owned module
//   2. dynamic `import()` inside a try/catch
//   3. top-level await in an owned module
//
// We deliberately do NOT use the local `buildBundleFixture` helper here.
// That harness is locked to `platform: 'neutral'` for ESM and does
// not expose `nodePaths`. We keep `platform: 'node'` and `nodePaths` here
// so the fixture matches real package resolution from an off-tree root.
// Extending the shared harness is out of scope per
// the task constraints (only `packages/build/test/contract/` may change).
//
// Each test:
//   (a) writes fixture files into a fresh real-path tmp dir,
//   (b) bundles via esbuild + the real `ownheim()` plugin export,
//   (c) asserts the bundle text contains the injected owner literal
//       initializer originating in `feature.ts`,
//   (d) executes the bundle in a subprocess via `runBundleInSubprocess`
//       and parses the structured log line off stdout.

import { describe, expect, it } from 'bun:test';
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { ownheim } from '@ownheim/build/esbuildPlugin';
import { runBundleInSubprocess } from '../helpers/runBundleInSubprocess.ts';
import type { Team, OwnheimConfig } from '@ownheim/core/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = resolve(HERE, '../../../..');

interface BuiltFixture {
  readonly text: string;
  readonly cleanup: () => Promise<void>;
}

interface FixtureFiles {
  readonly entry: string;
  readonly feature: string;
}

async function buildContractFixture<TTeams extends Record<string, Team>>(
  files: FixtureFiles,
  config: OwnheimConfig<TTeams>,
): Promise<BuiltFixture> {
  // realpath() collapses macOS's /var → /private/var symlink so that
  // `relative(projectRoot, args.path)` inside the ownheim plugin yields
  // `src/feature.ts` (matchable by picomatch) rather than a leading-`..`
  // path that picomatch refuses to match against `**`.
  const fixtureRoot = await realpath(await mkdtemp(join(tmpdir(), 'ownheim-a3-')));

  const writeFx = async (rel: string, contents: string): Promise<void> => {
    const abs = resolve(fixtureRoot, rel);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, contents, 'utf8');
  };

  await writeFx('src/entry.ts', files.entry);
  await writeFx('src/feature.ts', files.feature);

  const result = await build({
    entryPoints: [resolve(fixtureRoot, 'src/entry.ts')],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    // Make workspace packages resolvable from a fixture root
    // that lives outside the workspace tree. Use the monorepo root rather
    // than `process.cwd()` so the test passes regardless of where it's
    // invoked from (workspace root, package dir, or via turbo).
    nodePaths: [resolve(MONOREPO_ROOT, 'node_modules')],
    absWorkingDir: fixtureRoot,
    plugins: [ownheim({ config, projectRoot: fixtureRoot })],
  });

  const text = result.outputFiles?.[0]?.text ?? '';
  return {
    text,
    cleanup: async () => {
      await rm(fixtureRoot, { recursive: true, force: true });
    },
  };
}

const teams: Record<string, Team> = {
  billing: { github: '@org/billing', owns: ['src/feature.ts'] },
};

const billingConfig: OwnheimConfig<typeof teams> = { teams };

/**
 * Assert that the bundle contains owner injection originating in the owned
 * `feature.ts`. esbuild emits a `// src/feature.ts` banner comment above each
 * module's chunk; the `"billing"` literal is the plugin-injected owner.
 */
function expectOwnerInjectionForFeature(bundleText: string): void {
  expect(bundleText).toContain('src/feature.ts');
  expect(bundleText).toContain('"billing"');
}

function parseFirstJsonLine(stdout: string): Record<string, unknown> {
  const line = stdout.split('\n').find((l) => l.trim().startsWith('{'));
  if (!line) {
    throw new Error(`no JSON log line in stdout: ${JSON.stringify(stdout)}`);
  }
  return JSON.parse(line) as Record<string, unknown>;
}

describe('A3 — dynamic import + TLA contract', () => {
  describe('Group 1: dynamic import of an owned module', () => {
    it('rewrite survives `await import()` of an owned module', async () => {
      const fixture = await buildContractFixture(
        {
          entry: `await import('./feature.ts').then((m) => m.run());\n`,
          feature: [
            ``,
            `export function run() {`,
            `  console.log(JSON.stringify({ team: __OWNER__, msg: 'hi-from-feature' }));`,
            `}`,
            ``,
          ].join('\n'),
        },
        billingConfig,
      );

      try {
        expectOwnerInjectionForFeature(fixture.text);

        const run = await runBundleInSubprocess(fixture.text, { runtime: 'bun' });
        expect(run.code).toBe(0);
        const log = parseFirstJsonLine(run.stdout);
        expect(log['team']).toBe('billing');
        expect(log['msg']).toBe('hi-from-feature');
      } finally {
        await fixture.cleanup();
      }
    });
  });

  describe('Group 2: dynamic import inside a try/catch', () => {
    it('rewrite survives an `await import()` wrapped in try/catch', async () => {
      const fixture = await buildContractFixture(
        {
          entry: [
            `try {`,
            `  const m = await import('./feature.ts');`,
            `  m.run();`,
            `} catch (err) {`,
            `  console.error('dynamic import failed', err);`,
            `  process.exit(1);`,
            `}`,
            ``,
          ].join('\n'),
          feature: [
            ``,
            `export function run() {`,
            `  console.log(JSON.stringify({ team: __OWNER__, msg: 'hi-from-try-catch' }));`,
            `}`,
            ``,
          ].join('\n'),
        },
        billingConfig,
      );

      try {
        // esbuild may either inline the dynamic chunk into the bundle or
        // split it; either way, the owner injection must be present and
        // tagged with `src/feature.ts`.
        expectOwnerInjectionForFeature(fixture.text);

        const run = await runBundleInSubprocess(fixture.text, { runtime: 'bun' });
        expect(run.code).toBe(0);
        const log = parseFirstJsonLine(run.stdout);
        expect(log['team']).toBe('billing');
        expect(log['msg']).toBe('hi-from-try-catch');
      } finally {
        await fixture.cleanup();
      }
    });
  });

  describe('Group 3: top-level await', () => {
    it('rewrite survives top-level `await` in the owned module', async () => {
      const fixture = await buildContractFixture(
        {
          // Static import of the owned module; the entry itself contains no
          // owner-tagged work. TLA lives in feature.ts.
          entry: `import './feature.ts';\n`,
          feature: [
            ``,
            ``,
            `async function someAsync() {`,
            `  return 'ready';`,
            `}`,
            ``,
            `// Top-level await: requires ESM target.`,
            `await someAsync();`,
            ``,
            `console.log(JSON.stringify({ team: __OWNER__, msg: 'hi-after-tla' }));`,
            ``,
          ].join('\n'),
        },
        billingConfig,
      );

      try {
        expectOwnerInjectionForFeature(fixture.text);

        const run = await runBundleInSubprocess(fixture.text, { runtime: 'bun' });
        expect(run.code).toBe(0);
        const log = parseFirstJsonLine(run.stdout);
        expect(log['team']).toBe('billing');
        expect(log['msg']).toBe('hi-after-tla');
      } finally {
        await fixture.cleanup();
      }
    });
  });
});
