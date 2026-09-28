import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import type { Database } from '@infrastructure/database/drizzle'
import type { Env } from '@config/env'

export type AuthConfig = Pick<
  Env,
  | 'NODE_ENV'
  | 'BETTER_AUTH_SECRET'
  | 'BETTER_AUTH_URL'
  | 'CORS_ORIGIN'
  | 'DISCORD_CLIENT_ID'
  | 'DISCORD_CLIENT_SECRET'
>

export function createAuth(db: Database, config: AuthConfig) {
  const isProduction = config.NODE_ENV === 'production'

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'pg',
    }),
    secret: config.BETTER_AUTH_SECRET,
    baseURL: config.BETTER_AUTH_URL,
    trustedOrigins: [config.CORS_ORIGIN, config.BETTER_AUTH_URL],
    socialProviders: {
      discord: {
        clientId: config.DISCORD_CLIENT_ID,
        clientSecret: config.DISCORD_CLIENT_SECRET,
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
    },
    advanced: {
      // Required for cross-origin auth (client and server on different domains)
      defaultCookieAttributes: isProduction ? { sameSite: 'none', secure: true } : {},
    },
  })
}

export type Auth = ReturnType<typeof createAuth>
export type Session = Auth['$Infer']['Session']
export type User = Session['user']
