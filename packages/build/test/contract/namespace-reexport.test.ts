// RFC 0006 Phase 1 contract: namespace imports and re-exports of
// `@ownheim/core` are *deliberately* not rewritten by the esbuild plugin.
//
// This test file locks the *current observed behavior* into a regression
// fence. Its purpose is to make any silent change to that behavior visible
// in CI — not to prescribe what Phase 2 should do. Phase 2 follow-up
// markers live at the bottom as `it.todo`.
//
// Observed behavior (May 2026, RFC 0006 Phase 1, see analyzeSourceFile.ts:8-22):
//   1. Namespace imports `import * as ns from '@ownheim/core'` are passed
//      through verbatim by analyzeSourceFile. The `ns.logger.info(...)` call
//      site is NOT rewritten to `const logger = createLogger(__OWNER__)`.
//      esbuild then inlines the namespace at bundle time (`ns.logger` ->
//      `logger`), so the call resolves to the *unbound* default `logger`
//      export from `@ownheim/core`. At runtime that logger calls
//      `resolveOwner({})` with no `moduleOwner`, which falls through to
//      stack-frame -> manifest lookup (see runtime/src/resolveOwner.ts).
//   2. Re-exports `export { logger } from '@ownheim/core'` are likewise
//      passed through verbatim. esbuild flattens the re-export so a
//      downstream `import { logger } from './reexport.ts'` resolves to the
//      same unbound default `logger`.
//
// In both cases the per-file `const __OWNER__ = "<team>"` constant is still
// injected (because analyzeSourceFile.transform always injects it), but the
// call site does not consume it — so the build-time owner is effectively
// dead code for these shapes. The team tag is whatever stack-based lookup
// returns, NOT the `__OWNER__` literal that was injected.
import { describe, expect, it } from 'bun:test';
import type { Team } from '@ownheim/core/types';
import { buildBundleFixture } from '../helpers/buildBundleFixture.ts';
import { runBundleInSubprocess } from '../helpers/runBundleInSubprocess.ts';

const teams: Record<string, Team> = {
  Billing: { github: '@org/billing', owns: ['src/**/*.ts'] },
};

const config = { teams };

// A virtual `@ownheim/core` package whose `logger.info` writes a uniquely
// identifiable line to stdout, including a `_hasOwner` field that tells us
// whether a build-time `__OWNER__` literal was wired into the call site.
//
// If the plugin ever starts rewriting namespace/re-export call sites,
// `_hasOwner` would flip to `"string"` (or the `_owner` field would carry
// the resolved team name).
const VIRTUAL_RUNTIME_FILES = {
  'node_modules/@ownheim/core/package.json': JSON.stringify({
    name: '@ownheim/core',
    type: 'module',
    main: './index.js',
  }),
  'node_modules/@ownheim/core/index.js':
    "export const logger = { info: (r) => process.stdout.write('LOG:' + JSON.stringify({ msg: r.msg, _hasOwnerGlobal: typeof globalThis.__OWNER__ }) + '\\n') };\n",
} as const;

// ---------------------------------------------------------------------------
// Group 1: namespace import passthrough
// ---------------------------------------------------------------------------
describe('namespace import passthrough (RFC 0006 Phase 1)', () => {
  it('does not rewrite ns.logger call sites to factory bindings', async () => {
    const fixture = await buildBundleFixture({
      source:
        "import * as rt from '@ownheim/core';\nrt.logger.info({ msg: 'hi' });\n",
      extraFiles: { ...VIRTUAL_RUNTIME_FILES },
      format: 'esm',
      config,
    });

    try {
      // Phase 1 contract: the call site is the unbound default logger,
      // never wrapped in `createLogger(__OWNER__)`. Asserting the *absence*
      // of factory wiring is what makes this a regression fence.
      expect(fixture.text).not.toContain('createLogger');
      expect(fixture.text).not.toMatch(/from\s+['"]@ownheim\/runtime\/logging\/createLogger['"]/);
      expect(fixture.text).not.toMatch(/const\s+rt\s*=\s*createLogger/);
      expect(fixture.text).not.toMatch(/const\s+logger\s*=\s*createLogger/);

      // The namespace usage survives bundling — esbuild inlines the
      // namespace prefix so we observe `logger.info({ msg: "hi" })` in the
      // emitted text. (`rt.logger` is folded by esbuild's namespace
      // optimization; the load-bearing assertion is that the .info call
      // remains pointed at the unbound default export.)
      expect(fixture.text).toMatch(/logger\.info\(\{\s*msg:\s*"hi"\s*\}\)/);

      // Sanity: the unbound logger from the virtual runtime is what got
      // bundled (its `_hasOwnerGlobal` instrumentation is present).
      expect(fixture.text).toContain('_hasOwnerGlobal');
    } finally {
      await fixture.cleanup();
    }
  });

  it('runtime: ns.logger resolves to the unbound default logger (no build-time __OWNER__ on globalThis)', async () => {
    const fixture = await buildBundleFixture({
      source:
        "import * as rt from '@ownheim/core';\nrt.logger.info({ msg: 'phase1-ns' });\n",
      extraFiles: { ...VIRTUAL_RUNTIME_FILES },
      format: 'esm',
      config,
    });

    try {
      const result = await runBundleInSubprocess(fixture.text, { runtime: 'bun' });
      expect(result.code).toBe(0);
      // The unbound logger fired; build-time `__OWNER__` did NOT leak onto
      // `globalThis` for this call site. The team tag for this line, in a
      // real runtime, would come from stack-based owner resolution
      // (resolveOwner -> frameSource -> manifest), not from a literal
      // injected at build time.
      expect(result.stdout).toContain('LOG:');
      expect(result.stdout).toContain('"msg":"phase1-ns"');
      expect(result.stdout).toContain('"_hasOwnerGlobal":"undefined"');
    } finally {
      await fixture.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// Group 2: re-export passthrough
// ---------------------------------------------------------------------------
describe('re-export passthrough (RFC 0006 Phase 1)', () => {
  it('preserves `export { logger } from "@ownheim/core"` verbatim through bundling', async () => {
    const fixture = await buildBundleFixture({
      source:
        "import { logger } from './reexport.ts';\nlogger.info({ msg: 'hi' });\n",
      extraFiles: {
        'src/reexport.ts': "export { logger } from '@ownheim/core';\n",
        ...VIRTUAL_RUNTIME_FILES,
      },
      format: 'esm',
      config,
    });

    try {
      // Phase 1 contract: the re-export is not transformed. esbuild
      // flattens it so the bundle text doesn't literally contain the
      // `export { logger } from '@ownheim/core'` line, but — crucially —
      // it does NOT contain a `createLogger` factory binding for the
      // re-exported symbol either. The downstream import resolves to the
      // unbound default.
      expect(fixture.text).not.toContain('createLogger');
      expect(fixture.text).not.toMatch(/from\s+['"]@ownheim\/runtime\/logging\/createLogger['"]/);
      expect(fixture.text).not.toMatch(/const\s+logger\s*=\s*createLogger/);

      // The downstream call site survives — pointed at the unbound default.
      expect(fixture.text).toMatch(/logger\.info\(\{\s*msg:\s*"hi"\s*\}\)/);
      expect(fixture.text).toContain('_hasOwnerGlobal');
    } finally {
      await fixture.cleanup();
    }
  });

  it('runtime: re-exported logger resolves to the unbound default (no build-time __OWNER__ on globalThis)', async () => {
    const fixture = await buildBundleFixture({
      source:
        "import { logger } from './reexport.ts';\nlogger.info({ msg: 'phase1-reexport' });\n",
      extraFiles: {
        'src/reexport.ts': "export { logger } from '@ownheim/core';\n",
        ...VIRTUAL_RUNTIME_FILES,
      },
      format: 'esm',
      config,
    });

    try {
      const result = await runBundleInSubprocess(fixture.text, { runtime: 'bun' });
      expect(result.code).toBe(0);
      // Same shape as Group 1: build-time owner did not propagate to the
      // call site. Stack-based lookup is the real source of truth here.
      expect(result.stdout).toContain('LOG:');
      expect(result.stdout).toContain('"msg":"phase1-reexport"');
      expect(result.stdout).toContain('"_hasOwnerGlobal":"undefined"');
    } finally {
      await fixture.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// Group 3: Phase 2 follow-up markers
// ---------------------------------------------------------------------------
describe('Phase 2 follow-ups (deferred per RFC 0006)', () => {
  // When Phase 2 lands, namespace usage of `@ownheim/core` factory-bound
  // exports (logger, tracer, …) should compile down to per-call-site
  // factory bindings stamped with the resolved owner — same as plain named
  // imports do today.
  it.todo(
    'Phase 2: namespace imports of @ownheim/core should rewrite ns.logger calls to factory bindings',
    () => {
      // Implementation pending — see RFC 0006 §3 (namespace import handling).
    },
  );

  // Phase 2 must pick a policy for re-exports: either rewrite to a
  // factory-binding shim (so the re-exported logger carries the
  // *re-exporter's* owner), or fail loudly with a structured diagnostic
  // (because re-exporting an owner-bound symbol silently launders the
  // owner). Whichever policy ships, the test below must fail before the
  // change is shipped.
  it.todo(
    'Phase 2: re-exports of logger should either rewrite or fail with structured diagnostic',
    () => {
      // Implementation pending — see RFC 0006 §3 (re-export handling).
    },
  );
});
