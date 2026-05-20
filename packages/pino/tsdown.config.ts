import { defineConfig } from 'tsdown';
import { libraryDefaults } from '../../tsdown.base.mjs';

export default defineConfig({
  ...libraryDefaults,
  entry: [
    'src/index.ts',
    'src/mixin.ts',
  ],
  deps: {
    neverBundle: [
      '@ownheim/core',
      '@ownheim/core/*',
      'pino',
      'pino/*',
    ],
  },
});
