import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/commands/generate.ts',
    'src/commands/check.ts',
    'src/commands/coverage.ts',
    'src/commands/trace.ts'
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
