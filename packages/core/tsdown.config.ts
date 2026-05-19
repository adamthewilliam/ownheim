import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/defineOwnheim.ts',
    'src/OwnedError.ts',
    'src/symbols.ts',
    'src/types.ts',
    'src/ownership.ts',
    'src/resolution/frames.ts',
    'src/resolution/walkOwnedErrorChain.ts',
    'src/resolution/lookupCallerOwner.ts',
    'src/manifest/ManifestRegistry.ts',
    'src/manifest/defaultRegistry.ts',
    'src/logging/createLogger.ts',
    'src/logging/formatOwnedLogEntry.ts',
    'src/logging/LogSink.ts',
    'src/logging/defaultLogSink.ts',
    'src/tracing/createTracer.ts',
    'src/tracing/resolveTagOptions.ts',
    'src/tracing/ownershipTags.ts'
],
  format: ['esm', 'cjs'],
  dts: true,
  external: [],
  clean: true,
  sourcemap: true,
  treeshake: false,
});
