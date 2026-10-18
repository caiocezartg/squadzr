import 'server-only'
import * as z from 'zod/mini'
import { env } from './env'

const serverEnvSchema = z.object({
  // Set when the Next server reaches Fastify on an address the browser cannot use, such as a
  // private network name. Unset, the server calls the public API URL. It is the base of a fetch,
  // so only an HTTP(S) address is accepted.
  API_INTERNAL_URL: z.optional(z.url({ protocol: /^https?$/ })),
})

/**
 * Validates the server variables and throws when one is invalid. The module calls it as it loads,
 * so the server refuses to start with a bad value.
 */
export function parseServerEnv(source: { API_INTERNAL_URL?: string | undefined }) {
  const result = serverEnvSchema.safeParse(source)

  if (!result.success) {
    console.error('Invalid environment variables:', z.treeifyError(result.error))
    throw new Error('Invalid environment variables')
  }

  return result.data
}

const serverEnv = parseServerEnv({ API_INTERNAL_URL: process.env.API_INTERNAL_URL })

/** The base URL of every call the Next server makes to Fastify. */
export const API_INTERNAL_URL = serverEnv.API_INTERNAL_URL ?? env.NEXT_PUBLIC_API_URL
