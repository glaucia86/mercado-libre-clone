import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      },
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.d.ts',
        '**/main.ts',
        '**/*.config.*',
        '**/coverage/**'
      ]
    },
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    testTimeout: 10000,
    hookTimeout: 10000,
    reporters: ['verbose', 'html'],
    outputFile: {
      html: './coverage/test-report.html'
    },
    watch: false,
    isolate: true,
    setupFiles: ['./tests/setup.ts']
  },
  resolve: {
    alias: {
      '@/application': resolve(__dirname, './src/application'),
      '@/domain': resolve(__dirname, './src/domain'),
      '@/infrastructure': resolve(__dirname, './src/infrastructure'),
      '@/presentation': resolve(__dirname, './src/presentation'),
      '@/shared': resolve(__dirname, './src/shared')
    }
  }
})