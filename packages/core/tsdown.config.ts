import { defineConfig } from 'tsdown';
import { libraryDefaults } from '../../tsdown.base.mjs';

export default defineConfig({
  ...libraryDefaults,
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
    'src/logging/formatOwnedLogEntry.ts',
    'src/tracing/resolveTagOptions.ts',
    'src/tracing/ownershipTags.ts',
    'src/tracing/projectOwnership.ts',
  ],
  deps: {
    neverBundle: [],
  },
});
