import { defineConfig } from 'tsdown';
import { libraryDefaults } from '../../tsdown.base.mjs';

export default defineConfig({
  ...libraryDefaults,
  entry: [
    'src/index.ts',
    'src/types.ts',
    'src/adapter.ts',
    'src/validateFileOwnership.ts',
    'src/validateCodeownersEdit.ts',
    'src/rules/noOwnheim.ts',
    'src/rules/noCodeownersEdit.ts',
    'src/rules/registry.ts',
  ],
  deps: {
    neverBundle: [
      '@ownheim/build',
      '@ownheim/build/*',
      '@ownheim/core',
      '@ownheim/core/*',
    ],
  },
});
