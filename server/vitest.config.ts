import path from 'path'
import { defineConfig } from 'vitest/config'

// Shared with vitest.integration.config.ts so both projects resolve the same aliases.
export const serverAliases = {
  '@': path.resolve(__dirname, './src'),
  '@domain': path.resolve(__dirname, './src/domain'),
  '@application': path.resolve(__dirname, './src/application'),
  '@infrastructure': path.resolve(__dirname, './src/infrastructure'),
  '@interface': path.resolve(__dirname, './src/interface'),
  '@config': path.resolve(__dirname, './src/config'),
  '@test': path.resolve(__dirname, './src/test'),
}

export default defineConfig({
  test: {
    name: 'server:unit',
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
  resolve: {
    alias: serverAliases,
  },
})
