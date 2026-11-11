import { bindings, defineConfig, defineWorker } from 'cf/config'

export default defineConfig({
  worker: defineWorker({
    name: 'squadzr-web',
    entrypoint: 'vinext/server/fetch-handler',
    compatibilityDate: '2026-11-10',
    compatibilityFlags: ['nodejs_compat'],
    // The Worker serves the apex; `www.squadzr.app` is redirected to it by a Cloudflare rule.
    domains: ['squadzr.app'],
    assets: {
      htmlHandling: 'none',
      notFoundHandling: 'none',
      runWorkerFirst: ['/*', '!/_next/static/*', '!/*/_next/static/*'],
    },
    env: {
      ASSETS: bindings.assets(),
      // The edge secret the Next server sends to the API. Set once with `cf`, never in the repository.
      EDGE_AUTH_TOKEN: bindings.secret(),
    },
  }),
})
