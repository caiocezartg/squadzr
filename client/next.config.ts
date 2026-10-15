import type { NextConfig } from 'next'
// Importing the env module validates NEXT_PUBLIC_API_URL while the build loads this file.
import './src/env'

const nextConfig: NextConfig = {
  // Hosts that may load the dev server through the ngrok tunnel (Vite's allowedHosts).
  allowedDevOrigins: ['ngrok-free.dev', '*.ngrok-free.dev'],
  // The root AGENTS.md is the agent guide for this repository; keep Next from adding another.
  agentRules: false,
}

export default nextConfig
