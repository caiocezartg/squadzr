import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'og:unit',
    environment: 'node',
    include: ['src/**/*.spec.{ts,tsx}'],
  },
})
