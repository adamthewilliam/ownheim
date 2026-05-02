export interface FrameSource {
  /** Yields candidate file paths in the order they should be consulted. */
  frames(): Iterable<string>;
}
