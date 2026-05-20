import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/analyzeSourceFile.ts',
    'src/auditOwnership.ts',
    'src/resolveRules.ts',
    'src/generateCodeowners.ts',
    'src/generateManifest.ts',
    'src/generateArtifacts.ts',
    'src/esbuildPlugin.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  external: [
    '@ownheim/core',
    '@ownheim/core/*',
    'esbuild',
    'esbuild/*',
    'picomatch',
    'picomatch/*',
    'ts-morph',
    'ts-morph/*',
  ],
  clean: true,
  sourcemap: true,
  treeshake: true,
});
