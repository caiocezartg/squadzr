import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'types:unit',
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
})
