import type { Plugin } from 'vite'

/**
 * Preloads the two font files the first paint needs (CCC-43): the hero title
 * face (Exo 2 800) and the body base face (Plus Jakarta Sans 400), both from
 * the `latin` subset. These are exactly the families named by the `heading`
 * and `body` tokens in `tailwind.config.ts`.
 *
 * `href` has to be the hashed URL Vite emits for the `@font-face` sources, so
 * the plugin matches the emitted assets by original file name in the build
 * bundle. Importing the `.woff2` files from JavaScript would put font URLs in
 * the initial chunk, which `scripts/bundle-budget.mjs` measures as JavaScript.
 */
const PRELOADED_FONT_FILES = [
  'exo-2-latin-800-normal.woff2',
  'plus-jakarta-sans-latin-400-normal.woff2',
]

export function fontPreload(): Plugin {
  return {
    name: 'squadzr:font-preload',
    apply: 'build',
    transformIndexHtml: {
      // Runs after the bundle is generated so emitted font assets are visible.
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html

        const tags = PRELOADED_FONT_FILES.map((fontFile) => {
          const asset = Object.values(ctx.bundle).find(
            (entry) =>
              entry.type === 'asset' &&
              entry.originalFileNames.some((source) => source.endsWith(fontFile))
          )

          if (!asset) {
            throw new Error(
              `font-preload: no emitted asset matches "${fontFile}". ` +
                'Is the font still imported by a stylesheet?'
            )
          }

          return {
            tag: 'link',
            attrs: {
              rel: 'preload',
              as: 'font',
              type: 'font/woff2',
              crossorigin: true,
              href: `/${asset.fileName}`,
            },
            injectTo: 'head-prepend' as const,
          }
        })

        return { html, tags }
      },
    },
  }
}
