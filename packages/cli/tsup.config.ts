import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  sourcemap: false,
  treeshake: true,
  external: ['dc2mermaid-core', 'commander', 'chalk', 'clipboardy'],
  outDir: 'dist',
  // Note: shebang is added manually — don't use banner here as it breaks ESM
});
