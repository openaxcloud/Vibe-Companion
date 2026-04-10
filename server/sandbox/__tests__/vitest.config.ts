import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 180000,
    hookTimeout: 60000,
    teardownTimeout: 30000,
    include: ['**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../../client/src'),
      '@shared': path.resolve(__dirname, '../../../shared'),
    },
  },
});
