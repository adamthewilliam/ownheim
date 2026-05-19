import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/buildBundleFixture.ts',
    'src/runBundleInSubprocess.ts',
    'src/captureStructuredLogs.ts',
    'src/createInMemoryOtelExporter.ts',
    'src/RecordedSpan.ts'
],
  format: ['esm', 'cjs'],
  dts: true,
  external: [
    'esbuild',
    'esbuild/*'
],
  clean: true,
  sourcemap: true,
  treeshake: false,
});
