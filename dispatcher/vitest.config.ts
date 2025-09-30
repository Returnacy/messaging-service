import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  optimizeDeps: {
    include: ['@returnacy/event-contracts']
  },
  resolve: {
    preserveSymlinks: true
  },
  plugins: [tsconfigPaths()],
});
