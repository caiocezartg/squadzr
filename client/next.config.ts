import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import { parseServerEnv } from './src/env.server-schema'
// Importing the env module validates NEXT_PUBLIC_API_URL while the build loads this file.
import './src/env'

// Next loads this file for `next dev`, `next build` and `next start` before the server handles a
// request, so a bad API_INTERNAL_URL stops the start instead of failing every request.
parseServerEnv({ API_INTERNAL_URL: process.env.API_INTERNAL_URL })

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
