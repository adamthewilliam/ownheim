import { defineConfig } from 'tsdown';
import { libraryDefaults } from '../../tsdown.base.mjs';

export default defineConfig({
  ...libraryDefaults,
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
  deps: {
    neverBundle: [
      '@ownheim/core',
      '@ownheim/core/*',
      'esbuild',
      'esbuild/*',
      'picomatch',
      'picomatch/*',
      'ts-morph',
      'ts-morph/*',
    ],
  },
});
