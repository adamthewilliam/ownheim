import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/Owner.ts',
    'src/ownedBy.ts',
    'src/Logger.ts',
    'src/Tracer.ts'
],
  format: ['esm', 'cjs'],
  dts: true,
  external: [
    '@ownheim/core',
    '@ownheim/core/*',
    'effect',
    'effect/*'
],
  clean: true,
  sourcemap: true,
  treeshake: false,
});
