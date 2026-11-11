import { defineConfig } from 'vitest/config'
import { serverAliases } from './vitest.config'

// Fastify injection + PostgreSQL 16 suites. Requires the test database from
// docker-compose.test.yml (or TEST_DATABASE_URL pointing at a PostgreSQL 16 server).
export default defineConfig({
  test: {
    name: 'server:integration',
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    globalSetup: ['./src/test/harness/global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: serverAliases,
  },
})
