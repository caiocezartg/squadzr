import { bindings, defineConfig, defineWorker, triggers } from 'cf/config'

/**
 * The `squadzr-og` Worker: it renders the link preview image of a Squad invite (GitHub #152) on
 * `squadzr.app/og/*`. It lives apart from `squadzr-web` so the renderer's WASM stays out of the site's
 * Worker, and so the Worker cache, which bills every request it sees, is on here only.
 */
export default defineConfig({
  worker: defineWorker({
    name: 'squadzr-og',
    entrypoint: './src/index.ts',
    compatibilityDate: '2026-11-10',
    // The JPEG encoder returns a `Buffer`.
    compatibilityFlags: ['nodejs_compat'],
    // A route on the zone, not a custom domain: `squadzr-web` keeps every other path of the apex.
    triggers: [triggers.fetch({ pattern: 'squadzr.app/og/*', zone: 'squadzr.app' })],
    workersDev: false,
    // One key always renders the same picture, so a repeat request is served without running the Worker.
    // The cache outlives deploys: a key always renders the same picture, and a design change moves every
    // Squad to new keys (`SQUAD_PREVIEW_DESIGN_VERSION`), so an old entry is never served for a new design.
    cache: { enabled: true, crossVersionCache: true },
    observability: { enabled: true },
    env: {
      // Public game data only: the game's name and cover.
      API_URL: bindings.text('https://api.squadzr.app'),
      // The edge secret `squadzr-web` also sends, so the API's origin lock lets the call in. Set once
      // with `cf`, never in the repository (docs/ops/client-on-cloudflare-workers.md).
      EDGE_AUTH_TOKEN: bindings.secret(),
    },
  }),
})
