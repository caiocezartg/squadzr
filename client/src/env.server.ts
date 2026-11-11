import 'server-only'
import { env } from './env'
import { parseServerEnv } from './env.server-schema'

export { parseServerEnv }

// Parsed as this module loads, when a request first needs the value. `next.config.ts` runs the same
// check when Next starts, so a bad value stops `next start` before it serves a request. On a Worker the
// secret is read from `process.env` too (the `nodejs_compat` flag fills it from the Worker's bindings).
const serverEnv = parseServerEnv({
  API_INTERNAL_URL: process.env.API_INTERNAL_URL,
  EDGE_AUTH_TOKEN: process.env.EDGE_AUTH_TOKEN,
})

/** The base URL of every call the Next server makes to Fastify. */
export const API_INTERNAL_URL = serverEnv.API_INTERNAL_URL ?? env.NEXT_PUBLIC_API_URL

/** The edge secret every call the Next server makes to Fastify carries, or `undefined` while the API has no lock. */
export const EDGE_AUTH_TOKEN = serverEnv.EDGE_AUTH_TOKEN
