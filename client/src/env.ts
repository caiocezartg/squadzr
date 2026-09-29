import { z } from 'zod'

const envSchema = z.object({
  VITE_API_URL: z.url().optional().default('http://localhost:3000'),
})

function validateEnv() {
  const env = {
    VITE_API_URL: import.meta.env['VITE_API_URL'],
  }

  const result = envSchema.safeParse(env)

  if (!result.success) {
    console.error('Invalid environment variables:', z.treeifyError(result.error))
    throw new Error('Invalid environment variables')
    return;
  }

  return result.data
}

export const env = validateEnv()

export const WS_URL = env.VITE_API_URL.replace(/^http/, 'ws') + '/ws'
