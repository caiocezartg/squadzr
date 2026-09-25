import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'schemas:unit',
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
})
