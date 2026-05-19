import { ManifestRegistry, type OwnershipManifest } from './ManifestRegistry.ts';

let defaultRegistry: ManifestRegistry = ManifestRegistry.empty();

export function getDefaultRegistry(): ManifestRegistry {
  return defaultRegistry;
}

export function setDefaultRegistry(registry: ManifestRegistry): void {
  defaultRegistry = registry;
}

export function resetDefaultRegistry(): void {
  defaultRegistry = ManifestRegistry.empty();
}

/**
 * Register the generated ownership manifest used by stack-frame based owner
 * resolution. Call this once during process startup after loading the JSON
 * produced by `strays generate`.
 */
export function registerOwnershipManifest(manifest: OwnershipManifest): ManifestRegistry {
  const registry = ManifestRegistry.fromManifest(manifest);
  setDefaultRegistry(registry);
  return registry;
}
