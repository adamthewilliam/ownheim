export interface OwnershipManifest {
  readonly version: 1;
  readonly files: Readonly<Record<string, string>>;
}

let activeManifest: OwnershipManifest | undefined;
let lookupCache: Map<string, string | undefined> | undefined;

export function loadManifest(manifest: OwnershipManifest): void {
  activeManifest = manifest;
  lookupCache = new Map();
}

export function clearManifest(): void {
  activeManifest = undefined;
  lookupCache = undefined;
}

export function lookupOwner(filePath: string): string | undefined {
  if (!activeManifest) return undefined;
  if (lookupCache?.has(filePath)) return lookupCache.get(filePath);

  const direct = activeManifest.files[filePath];
  if (direct !== undefined) {
    lookupCache?.set(filePath, direct);
    return direct;
  }

  const normalised = normalise(filePath);
  for (const [registered, owner] of Object.entries(activeManifest.files)) {
    if (normalise(registered) === normalised) {
      lookupCache?.set(filePath, owner);
      return owner;
    }
  }

  lookupCache?.set(filePath, undefined);
  return undefined;
}

function normalise(filePath: string): string {
  return filePath.replace(/^file:\/\//, '').replace(/\\/g, '/');
}
