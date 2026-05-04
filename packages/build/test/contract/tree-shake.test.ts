// A4 — Tree-shake survival contract.
//
// The strays esbuild plugin (packages/build/src/esbuildPlugin.ts) injects
// per-file `__OWNER__` constants and rewrites `import { logger } from
// '@strays/core'` into a `createLogger(<owner>)` factory call. Both of
// these are top-level statements with apparent side effects (function
// invocation, top-level binding) — but bundlers under aggressive
// configuration (`minify: true, treeShaking: true, sideEffects: false`) may
// still drop the wrapping module if nothing inside it is reachable from a
// retained entry point.
//
// This file is the contract: under each tree-shake-aggressive scenario, if
// a `logger.*` call survives DCE, the team tag emitted MUST be the rule-
// resolved owner. The second assertion in each scenario is documentary —
// it captures the current bundle text shape so a future regression in
// esbuild semantics is visible at review time, not in production.
//
// We bypass `buildBundleFixture` here and call esbuild directly because:
//   1. macOS `mkdtemp(tmpdir())` returns a path WITHOUT `/private`, while
//      esbuild's `args.path` is realpath-resolved (`/private/var/...`).
//      The harness uses the unresolved path as `projectRoot`, so the
//      strays plugin computes a relative path that begins with `..` —
//      breaking glob matching.
//   2. The harness does not expose `nodePaths`, so esbuild cannot resolve
//      the workspace's `@strays/core` package from a tmp-dir entry.
//
// We do continue to use `runBundleInSubprocess` from `@strays/test-utils`
// to keep execution-side semantics identical to the rest of the suite.

import { describe, expect, it } from 'bun:test';
import { build } from 'esbuild';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import type { Owner, StraysConfig } from '@strays/core/types';
import { strays } from '@strays/build/esbuildPlugin';
import { runBundleInSubprocess } from '@strays/test-utils/runBundleInSubprocess';

// ---------------------------------------------------------------------------
// Bundling helper — local replacement for `buildBundleFixture` that fixes
// the macOS realpath issue and supplies `nodePaths` for `@strays/core`.
// ---------------------------------------------------------------------------

interface BundleArgs {
  readonly files: Readonly<Record<string, string>>;
  readonly entry: string;
  readonly config: StraysConfig<Record<string, Owner>>;
  readonly minify?: boolean;
  readonly treeShake?: boolean;
  readonly defines?: Readonly<Record<string, string>>;
}

interface BundleArtefact {
  readonly text: string;
  readonly cleanup: () => Promise<void>;
}

async function bundleFixture(opts: BundleArgs): Promise<BundleArtefact> {
  const raw = await mkdtemp(join(tmpdir(), 'strays-treeshake-'));
  // realpathSync collapses `/var -> /private/var` on macOS so the relative
  // path computed inside the strays plugin matches the rule glob.
  const root = realpathSync(raw);

  for (const [rel, contents] of Object.entries(opts.files)) {
    const abs = resolve(root, rel);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, contents, 'utf8');
  }

  const entryAbs = resolve(root, opts.entry);
  // Workspace node_modules — relative to this test file.
  const nodeModulesPath = resolve(import.meta.dir, '../../../../node_modules');

  const result = await build({
    entryPoints: [entryAbs],
    bundle: true,
    write: false,
    format: 'esm',
    // platform: 'node' is required because the runtime imports
    // `node:async_hooks`. The plugin's transformation contract is
    // platform-independent; what we are exercising here is DCE.
    platform: 'node',
    absWorkingDir: root,
    nodePaths: [nodeModulesPath],
    ...(opts.minify === undefined ? {} : { minify: opts.minify }),
    ...(opts.treeShake === undefined ? {} : { treeShaking: opts.treeShake }),
    ...(opts.defines === undefined ? {} : { define: { ...opts.defines } }),
    plugins: [strays({ config: opts.config, projectRoot: root })],
  });

  const out = result.outputFiles?.[0];
  if (!out) throw new Error('bundleFixture: esbuild produced no output');

  return {
    text: out.text,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

// ---------------------------------------------------------------------------
// Shared config — Billing owns everything under src/.
// ---------------------------------------------------------------------------

const owners: Record<string, Owner> = {
  Billing: { id: 'Billing', github: '@org/billing' },
};

const billingConfig: StraysConfig<Record<string, Owner>> = {
  owners,
  rules: [{ glob: 'src/**', owner: 'Billing' }],
};

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

describe('A4 tree-shake survival contract', () => {
  it('Scenario 1: log call inside `process.env.NODE_ENV === "production"` branch survives with team tag', async () => {
    const fixture = await bundleFixture({
      files: {
        'src/entry.ts': `import { logger } from '@strays/core';

if (process.env.NODE_ENV === 'production') {
  logger.info({ msg: 'charging' });
}
`,
      },
      entry: 'src/entry.ts',
      config: billingConfig,
      minify: true,
      treeShake: true,
      defines: { 'process.env.NODE_ENV': '"production"' },
    });

    try {
      // Documentary: under define+minify+treeShake the bundle still calls
      // the factory with the rule-resolved owner literal at top level. If
      // a future esbuild release inlines the factory differently this
      // string match is the canary.
      expect(fixture.text).toContain('"Billing"');
      expect(fixture.text).toContain('charging');

      const ran = await runBundleInSubprocess(fixture.text, { runtime: 'bun' });
      expect(ran.code).toBe(0);
      // Survival contract: the team tag MUST be on every emitted log line.
      expect(ran.stdout).toContain('"team":"Billing"');
      expect(ran.stdout).toContain('"msg":"charging"');
    } finally {
      await fixture.cleanup();
    }
  });

  it('Scenario 2: exported-but-unused `billCustomer` — if retained, team tag is correct on execution', async () => {
    const fixture = await bundleFixture({
      files: {
        'src/entry.ts': `import { logger } from '@strays/core';

export function billCustomer() {
  logger.info({ msg: 'billing' });
}

console.log('hello-from-entry');
`,
      },
      entry: 'src/entry.ts',
      config: billingConfig,
      minify: true,
      treeShake: true,
    });

    try {
      // Documentary: in ESM with `format: 'esm'`, esbuild keeps exported
      // bindings (it does not know if a downstream tool will import them).
      // So we expect both the factory call and the function body to
      // remain. If either of these flips in the future, that's the
      // signal to revisit the contract.
      const billCustomerRetained = fixture.text.includes('billing');

      if (billCustomerRetained) {
        expect(fixture.text).toContain('"Billing"');
        // Exported function body retained → factory call retained →
        // team tag must be correct when invoked. The bundle's mangled
        // export name makes direct invocation awkward, so we build a
        // sibling fixture that imports + calls billCustomer through a
        // separate entry point. Same plugin, same flags, with a real
        // call site reachable from the entry.
        const invokerFixture = await bundleFixture({
          files: {
            'src/lib/billCustomer.ts': `import { logger } from '@strays/core';

export function billCustomer() {
  logger.info({ msg: 'billing' });
}
`,
            'src/entry.ts': `import { billCustomer } from './lib/billCustomer.ts';
billCustomer();
`,
          },
          entry: 'src/entry.ts',
          config: billingConfig,
          minify: true,
          treeShake: true,
        });
        try {
          const ran = await runBundleInSubprocess(invokerFixture.text, { runtime: 'bun' });
          expect(ran.code).toBe(0);
          expect(ran.stdout).toContain('"team":"Billing"');
          expect(ran.stdout).toContain('"msg":"billing"');
        } finally {
          await invokerFixture.cleanup();
        }
      } else {
        // If esbuild legitimately drops the function, no log is emitted —
        // there is nothing to assert and the survival contract is
        // vacuously satisfied. Documentary check: confirm the message
        // string is also gone.
        expect(fixture.text).not.toContain('billing');
      }

      // The standalone-entry log (`console.log('hello-from-entry')`)
      // always survives — it's a sanity check that the rest of the
      // entry isn't accidentally dropped along with the export.
      expect(fixture.text).toContain('hello-from-entry');
    } finally {
      await fixture.cleanup();
    }
  });

  it('Scenario 3: consumer with `sideEffects: false` — `__OWNER__` does not block tree-shaking; team tag retained when factory call is retained', async () => {
    // Variant A — billCustomer is imported but NOT called. With
    // sideEffects: false in the consumer's package.json, the entire
    // module (including the factory call AND the __OWNER__ constant)
    // should be eligible for DCE.
    const unused = await bundleFixture({
      files: {
        'package.json': JSON.stringify({
          name: 'consumer',
          type: 'module',
          sideEffects: false,
        }),
        'src/lib/billCustomer.ts': `import { logger } from '@strays/core';

export function billCustomer() {
  logger.info({ msg: 'billing' });
}
`,
        'src/entry.ts': `import { billCustomer } from './lib/billCustomer.ts';
console.log('hello-from-entry');
void billCustomer;
`,
      },
      entry: 'src/entry.ts',
      config: billingConfig,
      minify: true,
      treeShake: true,
    });

    try {
      // Survival contract (positive direction): the entry's own console
      // log survives — the rule-matching plugin did NOT mark the
      // consumer's module as containing module-level side effects that
      // break DCE.
      expect(unused.text).toContain('hello-from-entry');

      // Documentary: bundlers correctly drop the unreachable factory
      // call AND the __OWNER__ constant. The plugin's per-file
      // injections do NOT defeat `sideEffects: false`.
      expect(unused.text).not.toContain('createLogger');
      expect(unused.text).not.toContain('billing');
      expect(unused.text).not.toContain('__OWNER__');
      // The owner literal MUST also be gone — if it were present, that
      // would mean an injected statement was incorrectly retained.
      expect(unused.text).not.toContain('"Billing"');
    } finally {
      await unused.cleanup();
    }

    // Variant B — billCustomer is imported AND called. The factory must
    // be retained AND the team tag must be Billing on execution.
    const used = await bundleFixture({
      files: {
        'package.json': JSON.stringify({
          name: 'consumer',
          type: 'module',
          sideEffects: false,
        }),
        'src/lib/billCustomer.ts': `import { logger } from '@strays/core';

export function billCustomer() {
  logger.info({ msg: 'billing' });
}
`,
        'src/entry.ts': `import { billCustomer } from './lib/billCustomer.ts';
billCustomer();
`,
      },
      entry: 'src/entry.ts',
      config: billingConfig,
      minify: true,
      treeShake: true,
    });

    try {
      // Documentary: factory call retained alongside the function it
      // closes over; minified literal still appears.
      expect(used.text).toContain('"Billing"');
      expect(used.text).toContain('billing');

      const ran = await runBundleInSubprocess(used.text, { runtime: 'bun' });
      expect(ran.code).toBe(0);
      // Survival contract.
      expect(ran.stdout).toContain('"team":"Billing"');
      expect(ran.stdout).toContain('"msg":"billing"');
    } finally {
      await used.cleanup();
    }
  });
});
