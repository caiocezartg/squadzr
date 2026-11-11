import * as z from 'zod/mini'

// Kept out of `env.server.ts`, which is server-only, so `next.config.ts` can run the same check when
// Next starts.
const serverEnvSchema = z.object({
  // Set when the Next server reaches Fastify on an address the browser cannot use, such as a
  // private network name. Unset, the server calls the public API URL. It is the base of a fetch,
  // so only an HTTP(S) address is accepted.
  API_INTERNAL_URL: z.optional(z.url({ protocol: /^https?$/ })),
  // The secret the Cloudflare edge also writes on requests to the API (the API's `EDGE_AUTH_TOKEN`).
  // Set, every call the Next server makes carries it in the edge header, so the origin lock lets the
  // call in. Unset, no header is sent. Same rule as the API's: visible ASCII, at least 32 characters.
  EDGE_AUTH_TOKEN: z.optional(
    z
      .string()
      .check(
        z.regex(/^[!-~]+$/, 'EDGE_AUTH_TOKEN must be visible ASCII without spaces'),
        z.minLength(32, 'EDGE_AUTH_TOKEN must be at least 32 characters')
      )
  ),
})

/**
 * Validates the server variables and throws when one is invalid. `next.config.ts` calls it while
 * Next loads the config, before the server handles its first request, so a bad value stops the start.
 * An empty `EDGE_AUTH_TOKEN` counts as unset, like the API's, so a blank line in an env file is no lock.
 */
export function parseServerEnv(source: {
  API_INTERNAL_URL?: string | undefined
  EDGE_AUTH_TOKEN?: string | undefined
}) {
  const result = serverEnvSchema.safeParse({
    ...source,
    EDGE_AUTH_TOKEN: source.EDGE_AUTH_TOKEN === '' ? undefined : source.EDGE_AUTH_TOKEN,
  })

  if (!result.success) {
    // The issues name the variable and the rule, never the value.
    console.error('Invalid environment variables:', z.treeifyError(result.error))
    throw new Error('Invalid environment variables')
  }

  return result.data
}
