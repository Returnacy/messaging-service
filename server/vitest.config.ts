import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: [],
    restoreMocks: true,
    mockReset: true,
    clearMocks: true,
  },
  plugins: [tsconfigPaths()],
});
