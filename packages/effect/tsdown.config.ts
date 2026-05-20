import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/ownedBy.ts',
    'src/Logging.ts',
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
