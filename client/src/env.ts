import * as z from 'zod/mini'

const publicEnvSchema = z.object({
  // `_default` is zod/mini's export for defaults (the name `default` is
  // reserved): missing values fall back, present ones must be a URL.
  NEXT_PUBLIC_API_URL: z._default(z.optional(z.url()), 'http://localhost:3000'),
})

/** Validates the public variables and throws when one is invalid. `next.config.ts` calls it while the build loads the config, so a bad value fails the build. */
function parsePublicEnv(source: { NEXT_PUBLIC_API_URL?: string | undefined }) {
  const result = publicEnvSchema.safeParse(source)

  if (!result.success) {
    console.error('Invalid environment variables:', z.treeifyError(result.error))
    throw new Error('Invalid environment variables')
  }

  return result.data
}

// Next inlines NEXT_PUBLIC_* values only where the variable is read by its literal name.
export const env = parsePublicEnv({ NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL })

export const WS_URL = env.NEXT_PUBLIC_API_URL.replace(/^http/, 'ws') + '/ws'
