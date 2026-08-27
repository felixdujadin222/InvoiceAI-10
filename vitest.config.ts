import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    // Root-level tests (e.g. firestore.rules.test.ts) validate infra artifacts
    // like security rules; unit tests live under src/**.
    include: ['src/**/*.test.{ts,tsx}', '*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Unit coverage targets the pure logic layer (src/lib). Services are
      // integration-level (Firebase/Gemini/PDF) and covered by e2e separately.
      include: ['src/lib/**'],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 85,
        lines: 80,
      },
    },
  },
});