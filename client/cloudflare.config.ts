import { bindings, defineConfig, defineWorker } from 'cf/config'

// SPIKE (#150): a throwaway Worker on workers.dev. Never deployed under the `squadzr-web` name.
export default defineConfig({
  worker: defineWorker({
    name: 'squadzr-og-spike',
    entrypoint: 'vinext/server/fetch-handler',
    compatibilityDate: '2026-11-10',
    compatibilityFlags: ['nodejs_compat'],
    workersDev: true,
    // Workers Cache (docs: developers.cloudflare.com/workers/cache): serves a repeat request without running the Worker.
    cache: { enabled: true },
    observability: { enabled: true, headSamplingRate: 1 },
    assets: {
      htmlHandling: 'none',
      notFoundHandling: 'none',
      runWorkerFirst: ['/*', '!/_next/static/*', '!/*/_next/static/*'],
    },
    env: {
      ASSETS: bindings.assets(),
    },
  }),
})
