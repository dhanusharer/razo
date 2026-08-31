import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
    // Run tests sequentially — the singleton transaction store means order matters
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true }
    }
  }
});
