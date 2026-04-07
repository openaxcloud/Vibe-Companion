import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@pages': path.resolve(__dirname, 'src/pages'),
      '@styles': path.resolve(__dirname, 'src/styles'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setupTests.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx,js,jsx}'],
    exclude: ['node_modules', 'dist', '.{idea,git,cache,output,temp}/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'vite.config.{ts,js}',
        'vitest.config.{ts,js}',
        '**/index.{ts,tsx,js,jsx}',
        '**/*.d.ts',
        'src/test/**',
        'src/mocks/**',
      ],
    },
    environmentOptions: {
      jsdom: {
        url: 'http://localhost',
      },
    },
    css: {
      modules: {
        classNameStrategy: 'stable',
      },
    },
  },
});