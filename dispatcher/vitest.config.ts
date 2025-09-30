import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  // Excluding the contracts package from Vite's dependency optimization avoids
  // Vite trying to prebundle an older tarball version that lacked built dist files.
  // Node's native ESM/CJS resolution works fine for the current installed version.
  optimizeDeps: {
    exclude: ['@returnacy/event-contracts'],
  },
  resolve: {
    preserveSymlinks: true,
  },
  plugins: [tsconfigPaths()],
});
