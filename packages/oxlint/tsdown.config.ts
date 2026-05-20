import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/plugin.ts',
    'src/adapter.ts'
],
  format: ['esm', 'cjs'],
  dts: true,
  external: [
    '@ownheim/core',
    '@ownheim/core/*',
    '@ownheim/lint-core',
    '@ownheim/lint-core/*',
    'oxlint',
    'oxlint/*'
],
  clean: true,
  sourcemap: true,
  treeshake: true,
});
