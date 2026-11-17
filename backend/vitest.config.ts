import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC transforme les décorateurs et émet leurs métadonnées (DI Nest, TypeORM).
const plugins = [swc.vite({ module: { type: 'es6' } })];

export default defineConfig({
  oxc: false,
  test: {
    projects: [
      {
        plugins,
        oxc: false,
        test: { name: 'unit', include: ['src/**/tests/unit/**/*.test.ts'], environment: 'node' },
      },
      {
        plugins,
        oxc: false,
        test: {
          name: 'integration',
          include: ['src/**/tests/integration/**/*.int.test.ts'],
          environment: 'node',
          globalSetup: ['src/test-support/postgres.global-setup.ts'],
          hookTimeout: 120_000,
          testTimeout: 30_000,
        },
      },
      {
        plugins,
        oxc: false,
        test: {
          name: 'e2e',
          include: ['src/**/tests/e2e/**/*.e2e.test.ts'],
          environment: 'node',
          globalSetup: ['src/test-support/postgres.global-setup.ts'],
          hookTimeout: 120_000,
          testTimeout: 30_000,
        },
      },
    ],
  },
});
