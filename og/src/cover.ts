/** A cover that could not be read: the image cannot be rendered right now. */
export class CoverReadError extends Error {
  constructor(readonly status: number) {
    super(`Cover read failed with status ${status}`)
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

/** IGDB's image sizes: the 264×374 cover for the 224px box art, the 35×35 micro for the backdrop. */
export type CoverSize = 'cover_big' | 'micro'

const IGDB_IMAGE =
  /^(https:\/\/images\.igdb\.com\/igdb\/image\/upload\/)t_[a-z0-9_]+(\/[a-z0-9]+)\.[a-z]+$/i

/**
 * The cover's address in one IGDB size, as a JPEG. IGDB serves every cover in any size and format its
 * address names, and the renderer reads JPEG but not WebP. Any other address is kept as it is.
 */
export function igdbCover(coverUrl: string, size: CoverSize): string {
  const match = IGDB_IMAGE.exec(coverUrl)
  return match ? `${match[1]}t_${size}${match[2]}.jpg` : coverUrl
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}

/** Reads one image and hands it to the renderer as a data URI. */
async function readDataUri(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new CoverReadError(response.status)

  const type = response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
  const bytes = new Uint8Array(await response.arrayBuffer())
  return `data:${type};base64,${toBase64(bytes)}`
}

/**
 * Reads the game's cover in the two sizes the image draws. Small sources keep the render cheap: the
 * rasterizer's time goes mostly to decoding and scaling images.
 */
export async function readCover(coverUrl: string): Promise<CoverImages> {
  const [tile, backdrop] = await Promise.all([
    readDataUri(igdbCover(coverUrl, 'cover_big')),
    readDataUri(igdbCover(coverUrl, 'micro')),
  ])
  return { tile, backdrop }
}
