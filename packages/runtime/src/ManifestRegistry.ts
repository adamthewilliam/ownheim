import type { OwnershipManifest } from './OwnershipManifest.ts';

const EMPTY_MANIFEST: OwnershipManifest = { version: 1, files: {} };

export class ManifestRegistry {
  readonly #manifest: OwnershipManifest;
  readonly #cache: Map<string, string | undefined>;
  readonly #normalisedFiles: ReadonlyMap<string, string>;

  private constructor(manifest: OwnershipManifest) {
    this.#manifest = manifest;
    this.#cache = new Map();
    const normalised = new Map<string, string>();
    for (const [registered, owner] of Object.entries(manifest.files)) {
      normalised.set(normalise(registered), owner);
    }
    this.#normalisedFiles = normalised;
  }

  static fromManifest(manifest: OwnershipManifest): ManifestRegistry {
    return new ManifestRegistry(manifest);
  }

  static empty(): ManifestRegistry {
    return new ManifestRegistry(EMPTY_MANIFEST);
  }

  lookupOwner(filePath: string): string | undefined {
    if (this.#cache.has(filePath)) return this.#cache.get(filePath);

    const direct = this.#manifest.files[filePath];
    if (direct !== undefined) {
      this.#cache.set(filePath, direct);
      return direct;
    }

    const normalised = normalise(filePath);
    const owner = this.#normalisedFiles.get(normalised);
    this.#cache.set(filePath, owner);
    return owner;
  }
}

function normalise(filePath: string): string {
  return filePath.replace(/^file:\/\//, '').replace(/\\/g, '/');
}
