/** @type {Pick<import('tsdown').UserConfig, 'format' | 'dts' | 'clean' | 'sourcemap' | 'treeshake'>} */
export const libraryDefaults = {
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
};
