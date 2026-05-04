// A3 — Dynamic import + TLA contract tests.
//
// Goal: assert that the @strays/build esbuild plugin's import-rewrite +
// `__OWNER__` injection survive less-common module shapes:
//   1. dynamic `import()` of an owned module
//   2. dynamic `import()` inside a try/catch
//   3. top-level await in an owned module
//
// We deliberately do NOT use `buildBundleFixture` from @strays/test-utils
// here. That harness is locked to `platform: 'neutral'` for ESM and does
// not expose `nodePaths`. A runnable bundle that imports `@strays/core`
// requires (a) `platform: 'node'` so `node:async_hooks` (used by the
// runtime's AsyncLocalStorage) resolves, and (b) `nodePaths` pointing at
// the workspace's `node_modules` so the rewritten
// `@strays/core/logging/createLogger` subpath specifier resolves from the
// off-tree fixture root. Extending the shared harness is out of scope per
// the task constraints (only `packages/build/test/contract/` may change).
//
// Each test:
//   (a) writes fixture files into a fresh real-path tmp dir,
//   (b) bundles via esbuild + the real `strays()` plugin export,
//   (c) asserts the bundle text contains a `createLogger("<owner>")`
//       initializer originating in `feature.ts`,
//   (d) executes the bundle in a subprocess via `runBundleInSubprocess`
//       and parses the structured log line off stdout.

import { describe, expect, it } from 'bun:test';
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { strays } from '@strays/build/esbuildPlugin';
import { runBundleInSubprocess } from '@strays/test-utils/runBundleInSubprocess';
import type { Owner, StraysConfig } from '@strays/core/types';

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

async function buildContractFixture<TOwners extends Record<string, Owner>>(
  files: FixtureFiles,
  config: StraysConfig<TOwners>,
): Promise<BuiltFixture> {
  // realpath() collapses macOS's /var → /private/var symlink so that
  // `relative(projectRoot, args.path)` inside the strays plugin yields
  // `src/feature.ts` (matchable by picomatch) rather than a leading-`..`
  // path that picomatch refuses to match against `**`.
  const fixtureRoot = await realpath(await mkdtemp(join(tmpdir(), 'strays-a3-')));

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
    // Make `@strays/core/logging/createLogger` resolvable from a fixture root
    // that lives outside the workspace tree. Use the monorepo root rather
    // than `process.cwd()` so the test passes regardless of where it's
    // invoked from (workspace root, package dir, or via turbo).
    nodePaths: [resolve(MONOREPO_ROOT, 'node_modules')],
    absWorkingDir: fixtureRoot,
    plugins: [strays({ config, projectRoot: fixtureRoot })],
  });

  const text = result.outputFiles?.[0]?.text ?? '';
  return {
    text,
    cleanup: async () => {
      await rm(fixtureRoot, { recursive: true, force: true });
    },
  };
}

const owners: Record<string, Owner> = {
  billing: { id: 'billing', github: '@org/billing' },
};

const billingConfig: StraysConfig<typeof owners> = {
  owners,
  rules: [{ glob: 'src/feature.ts', owner: 'billing' }],
};

/**
 * Assert that the bundle contains the rewritten factory binding originating
 * in the owned `feature.ts`. esbuild emits a `// src/feature.ts` banner
 * comment above each module's chunk; the `createLogger("billing")` call we
 * assert on is the plugin's injected initializer.
 */
function expectFactoryBindingForFeature(bundleText: string): void {
  // Module-banner comment — survives both inline and split chunks because
  // esbuild always tags each module's IIFE/closure with its source path
  // ("// src/feature.ts").
  expect(bundleText).toContain('src/feature.ts');
  // The plugin's per-owner factory initializer. esbuild may emit it as
  // `const logger = createLogger("billing")` (top-level), as a hoisted
  // `var logger;` + `logger = createLogger("billing")` pair (when the
  // owned module is wrapped in an `__esm` chunk for dynamic-import
  // splitting), or as `var logger = createLogger("billing")`. All three
  // shapes preserve the team contract — the literal owner string lands
  // inside `createLogger(...)`.
  expect(bundleText).toMatch(/logger\s*=\s*createLogger\("billing"\)/);
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
            `import { logger } from '@strays/core';`,
            `export function run() {`,
            `  logger.info({ msg: 'hi-from-feature' });`,
            `}`,
            ``,
          ].join('\n'),
        },
        billingConfig,
      );

      try {
        expectFactoryBindingForFeature(fixture.text);

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
            `import { logger } from '@strays/core';`,
            `export function run() {`,
            `  logger.info({ msg: 'hi-from-try-catch' });`,
            `}`,
            ``,
          ].join('\n'),
        },
        billingConfig,
      );

      try {
        // esbuild may either inline the dynamic chunk into the bundle or
        // split it; either way, the factory-binding initializer must be
        // present and tagged with `src/feature.ts`.
        expectFactoryBindingForFeature(fixture.text);

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
          // logger calls. TLA lives in feature.ts.
          entry: `import './feature.ts';\n`,
          feature: [
            `import { logger } from '@strays/core';`,
            ``,
            `async function someAsync() {`,
            `  return 'ready';`,
            `}`,
            ``,
            `// Top-level await: requires ESM target.`,
            `await someAsync();`,
            ``,
            `logger.info({ msg: 'hi-after-tla' });`,
            ``,
          ].join('\n'),
        },
        billingConfig,
      );

      try {
        expectFactoryBindingForFeature(fixture.text);

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
