import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/types.ts',
    'src/adapter.ts',
    'src/validateFileOwnership.ts',
    'src/validateCodeownersEdit.ts',
    'src/rules/noOwnheim.ts',
    'src/rules/noCodeownersEdit.ts',
    'src/rules/registry.ts'
],
  format: ['esm', 'cjs'],
  dts: true,
  external: [
    '@ownheim/build',
    '@ownheim/build/*',
    '@ownheim/core',
    '@ownheim/core/*'
],
  clean: true,
  sourcemap: true,
  treeshake: true,
});
