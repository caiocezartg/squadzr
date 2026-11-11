import { defineConfig } from 'drizzle-kit'
import { z } from 'zod'

const databaseUrl = z.url().parse(process.env['DATABASE_URL'])

export default defineConfig({
  schema: './src/infrastructure/database/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
})
