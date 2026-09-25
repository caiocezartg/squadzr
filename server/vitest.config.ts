import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'server:unit',
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@domain': path.resolve(__dirname, './src/domain'),
      '@application': path.resolve(__dirname, './src/application'),
      '@infrastructure': path.resolve(__dirname, './src/infrastructure'),
      '@interface': path.resolve(__dirname, './src/interface'),
      '@config': path.resolve(__dirname, './src/config'),
      '@test': path.resolve(__dirname, './src/test'),
    },
  },
})
