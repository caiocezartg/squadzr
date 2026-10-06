import * as z from 'zod/mini'

const envSchema = z.object({
  // `_default` is zod/mini's export for defaults (the name `default` is
  // reserved): missing values fall back, present ones must be a URL.
  VITE_API_URL: z._default(z.optional(z.url()), 'http://localhost:3000'),
})

function validateEnv() {
  const env = {
    VITE_API_URL: import.meta.env['VITE_API_URL'],
  }

  const result = envSchema.safeParse(env)

  if (!result.success) {
    console.error('Invalid environment variables:', z.treeifyError(result.error))
    throw new Error('Invalid environment variables')
  }

  return result.data
}

export const env = validateEnv()

export const WS_URL = env.VITE_API_URL.replace(/^http/, 'ws') + '/ws'
