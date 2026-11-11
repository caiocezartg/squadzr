import { defineConfig } from 'vite'
import vinext from 'vinext'
import { cloudflare } from '@cloudflare/vite-plugin'

// No cache adapter and no image optimizer: `revalidate` keeps its response in each isolate's memory
// and `next/image` serves Discord avatars from their own CDN (docs/adr/0006).
export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: 'rsc',
        childEnvironments: ['ssr'],
      },
    }),
  ],
})
