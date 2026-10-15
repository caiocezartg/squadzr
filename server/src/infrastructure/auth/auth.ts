import { betterAuth, type BetterAuthAdvancedOptions } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import type { Database } from '@infrastructure/database/drizzle'
import type { Env } from '@config/env'

export type AuthConfig = Pick<
  Env,
  | 'NODE_ENV'
  | 'BETTER_AUTH_SECRET'
  | 'BETTER_AUTH_URL'
  | 'BETTER_AUTH_COOKIE_DOMAIN'
  | 'CORS_ORIGIN'
  | 'DISCORD_CLIENT_ID'
  | 'DISCORD_CLIENT_SECRET'
>

export function createAuth(db: Database, config: AuthConfig) {
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
        // Refresh name and image on every sign-in: Discord drops the old avatar file
        // when its hash changes, so the stored image URL would answer 404.
        overrideUserInfoOnSignIn: true,
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
    },
    advanced: cookieAdvancedOptions(config),
  })
}

/**
 * Cookie settings of the session cookie. Without a cookie domain, the app and the API sit on
 * unrelated domains, so production cookies are `SameSite=None`. With one, they sit on subdomains
 * of the same parent domain: the cookie spans them, and `SameSite=Lax` still reaches the API
 * because subdomains of one parent domain are same-site.
 */
function cookieAdvancedOptions(config: AuthConfig): BetterAuthAdvancedOptions {
  const isProduction = config.NODE_ENV === 'production'

  if (config.BETTER_AUTH_COOKIE_DOMAIN) {
    return {
      crossSubDomainCookies: { enabled: true, domain: config.BETTER_AUTH_COOKIE_DOMAIN },
      defaultCookieAttributes: isProduction ? { sameSite: 'lax', secure: true } : {},
    }
  }

  // Required for cross-origin auth (client and server on different domains)
  return {
    defaultCookieAttributes: isProduction ? { sameSite: 'none', secure: true } : {},
  }
}

export type Auth = ReturnType<typeof createAuth>
export type Session = Auth['$Infer']['Session']
export type User = Session['user']
