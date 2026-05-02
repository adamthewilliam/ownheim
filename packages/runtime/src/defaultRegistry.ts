import { ManifestRegistry } from './ManifestRegistry.ts';

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
