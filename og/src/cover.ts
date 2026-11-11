/** A cover that could not be read right now: the image is unavailable and the next request tries again. */
export class CoverReadError extends Error {
  constructor(readonly reason: string) {
    super(`Cover read failed: ${reason}`)
    this.name = 'CoverReadError'
  }
}

/** The cover twice: sharp for the box art, tiny for the backdrop. */
export interface CoverImages {
  /** The box art, as a data URI. */
  readonly tile: string
  /** A tiny copy, as a data URI: stretched behind the box art, it reads as a blur at no cost. */
  readonly backdrop: string
}

/** IGDB's image sizes: the 264×374 cover for the 270px box art, the 35×35 micro for the backdrop. */
export type CoverSize = 'cover_big' | 'micro'

/** The only images the Worker fetches: IGDB's image CDN, over HTTPS. */
const IGDB_IMAGE =
  /^(https:\/\/images\.igdb\.com\/igdb\/image\/upload\/)t_[a-z0-9_]+(\/[a-z0-9]+)\.[a-z]+$/

/** A cover far above the 264px size is no cover the catalog stores. */
export const COVER_MAX_BYTES = 1_000_000

const COVER_TYPES = new Set(['image/jpeg', 'image/png'])

/** How long a cover read may take before the image counts as unavailable. */
export const COVER_TIMEOUT_MS = 5000

/**
 * The cover's address on IGDB in one size, as a JPEG, or `null` for an address that is not an IGDB
 * cover. IGDB serves every cover in any size and format its address names; the renderer reads JPEG.
 */
export function igdbCover(coverUrl: string, size: CoverSize): string | null {
  const match = IGDB_IMAGE.exec(coverUrl)
  return match ? `${match[1]}t_${size}${match[2]}.jpg` : null
}

/** Whether the Worker may fetch this game's cover at all. */
export function isIgdbCover(coverUrl: string): boolean {
  return IGDB_IMAGE.test(coverUrl)
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}

/**
 * Reads one IGDB image and hands it to the renderer as a data URI. It follows no redirect, gives up
 * after five seconds, and accepts only a JPEG or PNG within the size cap.
 */
async function readDataUri(url: string): Promise<string> {
  const response = await fetch(url, {
    // Workers have no `redirect: 'error'`: with `manual` a redirect comes back as a 3xx, which is not ok.
    redirect: 'manual',
    signal: AbortSignal.timeout(COVER_TIMEOUT_MS),
  })
  if (!response.ok) throw new CoverReadError(`status ${response.status}`)

  const type = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? ''
  if (!COVER_TYPES.has(type)) throw new CoverReadError(`type ${type || 'missing'}`)

  const declared = Number(response.headers.get('content-length') ?? 0)
  if (declared > COVER_MAX_BYTES) throw new CoverReadError('too large')

  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength > COVER_MAX_BYTES) throw new CoverReadError('too large')
  return `data:${type};base64,${toBase64(bytes)}`
}

/**
 * Reads the game's cover in the two sizes the image draws. Small sources keep the render cheap: the
 * rasterizer's time goes mostly to decoding and scaling images. Only an IGDB cover is ever fetched; the
 * caller checks `isIgdbCover` first, and any other address throws here without a request.
 */
export async function readCover(coverUrl: string): Promise<CoverImages> {
  const tile = igdbCover(coverUrl, 'cover_big')
  const backdrop = igdbCover(coverUrl, 'micro')
  if (!tile || !backdrop) throw new CoverReadError('not an IGDB cover')

  const [tileUri, backdropUri] = await Promise.all([readDataUri(tile), readDataUri(backdrop)])
  return { tile: tileUri, backdrop: backdropUri }
}
