import { defineConfig } from 'tsdown';
import { libraryDefaults } from '../../tsdown.base.mjs';

export default defineConfig({
  ...libraryDefaults,
  entry: [
    'src/index.ts',
    'src/commands/generate.ts',
    'src/commands/check.ts',
    'src/commands/coverage.ts',
  ],
  deps: {
    neverBundle: [
      '@ownheim/build',
      '@ownheim/build/*',
      '@ownheim/core',
      '@ownheim/core/*',
      'jiti',
      'jiti/*',
    ],
  },
});
