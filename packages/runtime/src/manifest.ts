import { ManifestRegistry } from './ManifestRegistry.ts';
import {
  getDefaultRegistry,
  resetDefaultRegistry,
  setDefaultRegistry,
} from './defaultRegistry.ts';
import type { OwnershipManifest } from './OwnershipManifest.ts';

export type { OwnershipManifest } from './OwnershipManifest.ts';

/**
 * @deprecated Construct a `ManifestRegistry` and pass it explicitly, or call
 * `setDefaultRegistry(ManifestRegistry.fromManifest(manifest))` at boot.
 */
export function loadManifest(manifest: OwnershipManifest): void {
  setDefaultRegistry(ManifestRegistry.fromManifest(manifest));
}

/**
 * @deprecated Use `resetDefaultRegistry()` from `@strays/runtime/defaultRegistry`.
 */
export function clearManifest(): void {
  resetDefaultRegistry();
}

/**
 * @deprecated Call `registry.lookupOwner(filePath)` on an explicit `ManifestRegistry`.
 */
export function lookupOwner(filePath: string): string | undefined {
  return getDefaultRegistry().lookupOwner(filePath);
}
