import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import { parseServerEnv } from './src/env.server-schema'
// Importing the env module validates NEXT_PUBLIC_API_URL while the build loads this file.
import './src/env'

// Next loads this file for `next dev`, `next build` and `next start` before the server handles a
// request, so a bad server variable stops the start instead of failing every request.
parseServerEnv({
  API_INTERNAL_URL: process.env.API_INTERNAL_URL,
  EDGE_AUTH_TOKEN: process.env.EDGE_AUTH_TOKEN,
})

// Scripts load only from the app. Next writes its bootstrap inline, so inline scripts stay allowed (a
// nonce would force every page to render per request); the dev server also evaluates code. Plugins,
// a foreign <base> and forms posting elsewhere are refused. Another site may not frame the app: a
// framed page could trick a signed-in player into a click that joins, leaves or ends a Squad.
// Images and connections are left open: covers, avatars and the API live on other origins.
const CONTENT_SECURITY_POLICY = [
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
  // Older browsers ignore frame-ancestors; this keeps them out of frames too.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // HTTPS only, for two years; browsers ignore it over plain HTTP, so local development is untouched.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
]

// Without locale routing, next-intl reads the locale and messages in `src/i18n/request.ts`.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  // Hosts that may load the dev server through the ngrok tunnel (Vite's allowedHosts).
  allowedDevOrigins: ['ngrok-free.dev', '*.ngrok-free.dev'],
  // The root AGENTS.md is the agent guide for this repository; keep Next from adding another.
  agentRules: false,
  // Without it, Turbopack keeps every zod locale in the root layout's JavaScript (about 40 kB gzip).
  experimental: { optimizePackageImports: ['zod'] },
  // Discord hosts the player avatars that the header shows through next/image.
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'cdn.discordapp.com' }],
  },
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }]
  },
  // The Squad Board moved from /rooms. The redirect is permanent (308) and keeps the query string, so
  // shared links and sign-in callbacks to the old path still reach the board and its ?join= invite.
  async redirects() {
    return [
      { source: '/rooms', destination: '/squads', permanent: true },
      { source: '/rooms/:code', destination: '/squads/:code', permanent: true },
    ]
  },
}

export default withNextIntl(nextConfig)
