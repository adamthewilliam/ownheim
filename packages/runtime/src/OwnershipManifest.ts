export interface OwnershipManifest {
  readonly version: 1;
  readonly files: Readonly<Record<string, string>>;
}
