import * as z from 'zod/mini'

// Kept out of `env.server.ts`, which is server-only, so `next.config.ts` can run the same check when
// Next starts.
const serverEnvSchema = z.object({
  // Set when the Next server reaches Fastify on an address the browser cannot use, such as a
  // private network name. Unset, the server calls the public API URL. It is the base of a fetch,
  // so only an HTTP(S) address is accepted.
  API_INTERNAL_URL: z.optional(z.url({ protocol: /^https?$/ })),
})

/**
 * Validates the server variables and throws when one is invalid. `next.config.ts` calls it while
 * Next loads the config, before the server handles its first request, so a bad value stops the start.
 */
export function parseServerEnv(source: { API_INTERNAL_URL?: string | undefined }) {
  const result = serverEnvSchema.safeParse(source)

  if (!result.success) {
    console.error('Invalid environment variables:', z.treeifyError(result.error))
    throw new Error('Invalid environment variables')
  }

  return result.data
}
