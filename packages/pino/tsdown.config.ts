import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/mixin.ts'
],
  format: ['esm', 'cjs'],
  dts: true,
  external: [
    '@ownheim/core',
    '@ownheim/core/*',
    'pino',
    'pino/*'
],
  clean: true,
  sourcemap: true,
  treeshake: false,
});
