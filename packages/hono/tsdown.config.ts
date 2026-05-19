import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/ownerMiddleware.ts'
],
  format: ['esm', 'cjs'],
  dts: true,
  external: [
    '@ownheim/core',
    '@ownheim/core/*'
],
  clean: true,
  sourcemap: true,
  treeshake: false,
});
