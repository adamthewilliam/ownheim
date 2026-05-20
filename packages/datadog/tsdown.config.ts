import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/instrument.ts',
    'src/rum.ts'
],
  format: ['esm', 'cjs'],
  dts: true,
  external: [
    '@ownheim/core',
    '@ownheim/core/*'
],
  clean: true,
  sourcemap: true,
  treeshake: true,
});
