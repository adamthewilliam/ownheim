import { defineConfig } from 'tsdown';
import { libraryDefaults } from '../../tsdown.base.mjs';

export default defineConfig({
  ...libraryDefaults,
  entry: [
    'src/index.ts',
    'src/SpanProcessor.ts',
    'src/resource.ts',
  ],
  deps: {
    neverBundle: [
      '@ownheim/core',
      '@ownheim/core/*',
    ],
  },
});
