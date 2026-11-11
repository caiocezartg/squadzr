import { SQUAD_PREVIEW_IMAGE_TYPE } from '@squadzr/schemas'

/** One year: a key always renders the same picture. */
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable'

/** A rendered image: a JPEG, cached as immutable by the Worker cache, crawlers and browsers. */
export function imageResponse(body: Uint8Array<ArrayBuffer>): Response {
  return new Response(body, {
    headers: {
      'content-type': SQUAD_PREVIEW_IMAGE_TYPE,
      'content-length': String(body.byteLength),
      'cache-control': IMMUTABLE_CACHE_CONTROL,
    },
  })
}
