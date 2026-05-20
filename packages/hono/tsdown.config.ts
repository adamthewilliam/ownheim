import { defineConfig } from 'tsdown';
import { libraryDefaults } from '../../tsdown.base.mjs';

export default defineConfig({
  ...libraryDefaults,
  entry: [
    'src/index.ts',
    'src/ownerMiddleware.ts',
  ],
  deps: {
    neverBundle: [
      '@ownheim/core',
      '@ownheim/core/*',
    ],
  },
});
