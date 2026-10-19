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
  // Discord hosts the player avatars that the header shows through next/image.
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'cdn.discordapp.com' }],
  },
}

export default withNextIntl(nextConfig)
