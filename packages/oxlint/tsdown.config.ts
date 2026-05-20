import { defineConfig } from 'tsdown';
import { libraryDefaults } from '../../tsdown.base.mjs';

export default defineConfig({
  ...libraryDefaults,
  entry: [
    'src/index.ts',
    'src/plugin.ts',
    'src/adapter.ts',
  ],
  deps: {
    neverBundle: [
      '@ownheim/core',
      '@ownheim/core/*',
      '@ownheim/lint-core',
      '@ownheim/lint-core/*',
      'oxlint',
      'oxlint/*',
    ],
  },
});
