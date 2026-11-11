import { z } from 'zod'

/** The bindings the Worker reads, as `cloudflare.config.ts` declares them. */
const envSchema = z.object({
  API_URL: z.url({ protocol: /^https?$/ }),
  // Same rule as the API's and `squadzr-web`'s: visible ASCII, at least 32 characters. Empty counts as unset.
  EDGE_AUTH_TOKEN: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z
      .string()
      .regex(/^[!-~]+$/)
      .min(32)
      .optional()
  ),
})

export type OgEnv = z.infer<typeof envSchema>

/** The Worker's bindings, validated. The error names the binding and the rule, never the value. */
export function parseEnv(source: unknown): OgEnv {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    const names = result.error.issues.map((issue) => issue.path.join('.')).join(', ')
    throw new Error(`Invalid Worker bindings: ${names}`)
  }
  return result.data
}
