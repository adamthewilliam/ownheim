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
    'eslint',
    'eslint/*'
],
  clean: true,
  sourcemap: true,
  treeshake: false,
});
