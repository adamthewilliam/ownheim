#!/usr/bin/env node
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import * as esbuild from 'esbuild';

const fixtures = [
  {
    name: 'core-owned-error-subpath',
    source: "import { OwnedError } from '@ownheim/core/OwnedError';\nconsole.log(OwnedError);\n",
  },
  {
    name: 'core-owned-error-root',
    source: "import { OwnedError } from '@ownheim/core';\nconsole.log(OwnedError);\n",
  },
  {
    name: 'core-manifest-registration-subpath',
    source:
      "import { registerOwnershipManifest } from '@ownheim/core/manifest/defaultRegistry';\nconsole.log(registerOwnershipManifest);\n",
  },
  {
    name: 'build-generate-codeowners-subpath',
    source: "import { generateCodeowners } from '@ownheim/build/generateCodeowners';\nconsole.log(generateCodeowners);\n",
  },
  {
    name: 'build-generate-codeowners-root',
    source: "import { generateCodeowners } from '@ownheim/build';\nconsole.log(generateCodeowners);\n",
  },
];

const dir = await mkdtemp(join(tmpdir(), 'ownheim-treeshake-'));
let failed = false;

try {
  console.log('Tree-shaking smoke check. Smaller subpath bundles indicate healthier consumer bundles.');
  console.log('Run `bun run build` first so package exports point at fresh dist files.\n');

  for (const fixture of fixtures) {
    const entry = join(dir, `${fixture.name}.mjs`);
    const outfile = join(dir, `${fixture.name}.bundle.mjs`);
    await writeFile(entry, fixture.source);

    try {
      await esbuild.build({
        entryPoints: [entry],
        outfile,
        bundle: true,
        minify: true,
        format: 'esm',
        platform: 'node',
        nodePaths: [join(process.cwd(), 'node_modules')],
        treeShaking: true,
        logLevel: 'silent',
      });
      const code = await readFile(outfile);
      const gzipBytes = gzipSync(code).byteLength;
      console.log(`OK   ${fixture.name.padEnd(38)} ${String(code.byteLength).padStart(7)} bytes (${gzipBytes} gzip)`);
    } catch (error) {
      failed = true;
      const message = error?.errors?.[0]?.text ?? error?.message ?? String(error);
      console.log(`FAIL ${fixture.name.padEnd(38)} ${message}`);
    }
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}

if (failed) process.exitCode = 1;
