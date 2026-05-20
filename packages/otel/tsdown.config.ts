import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/SpanProcessor.ts',
    'src/resource.ts'
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
