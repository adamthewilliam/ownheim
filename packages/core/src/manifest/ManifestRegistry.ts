export interface OwnershipManifestInput {
  readonly version?: number;
  readonly files: Readonly<Record<string, string>>;
}

export interface RegisteredOwnershipManifest {
  readonly files: Readonly<Record<string, string>>;
}

/**
 * @deprecated Use OwnershipManifestInput for runtime-loaded artifacts or
 * RegisteredOwnershipManifest for already-normalized registry input.
 */
export type OwnershipManifest = OwnershipManifestInput;

const EMPTY_MANIFEST: RegisteredOwnershipManifest = { files: {} };

export function normalizeOwnershipManifest(input: OwnershipManifestInput): RegisteredOwnershipManifest {
  if (input.version !== undefined && input.version !== 1) {
    throw new Error(`Unsupported Ownheim manifest version: ${input.version}`);
  }
  return { files: input.files };
}

export class ManifestRegistry {
  readonly #manifest: RegisteredOwnershipManifest;
  readonly #cache: Map<string, string | undefined>;
  readonly #normalisedFiles: ReadonlyMap<string, string>;
  readonly #size: number;

  private constructor(manifest: RegisteredOwnershipManifest) {
    this.#manifest = manifest;
    this.#cache = new Map();
    this.#size = Object.keys(manifest.files).length;
    const normalised = new Map<string, string>();
    for (const [registered, owner] of Object.entries(manifest.files)) {
      normalised.set(normalise(registered), owner);
    }
    this.#normalisedFiles = normalised;
  }

  static fromManifest(manifest: OwnershipManifestInput): ManifestRegistry {
    return new ManifestRegistry(normalizeOwnershipManifest(manifest));
  }

  static empty(): ManifestRegistry {
    return new ManifestRegistry(EMPTY_MANIFEST);
  }

  isEmpty(): boolean {
    return this.#size === 0;
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
