import bigShoulders900 from './fonts/BigShoulders-900.woff?inline'
import jakarta600 from './fonts/PlusJakartaSans-600.woff?inline'
import jakarta800 from './fonts/PlusJakartaSans-800.woff?inline'
// The site's own logo, the one the landing preview shows.
import logo from '../../client/public/squadzr-logo.svg?inline'

/** The logo as a data URI, ready for an `<img>`. */
export const LOGO_SRC = logo

type FontWeight = 600 | 800 | 900

export interface ImageFont {
  readonly name: string
  readonly data: ArrayBuffer
  readonly weight: FontWeight
  readonly style: 'normal'
}

function decodeDataUri(dataUri: string): ArrayBuffer {
  const binary = atob(dataUri.slice(dataUri.indexOf(',') + 1))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes.buffer
}

let fonts: ImageFont[] | undefined

/**
 * The site's fonts (Big Shoulders, Plus Jakarta Sans) as WOFF, which the renderer reads (it cannot read
 * WOFF2). They ship inside the Worker and are decoded once per isolate, never fetched at render time.
 */
export function imageFonts(): ImageFont[] {
  fonts ??= [
    { name: 'Big Shoulders', data: decodeDataUri(bigShoulders900), weight: 900, style: 'normal' },
    { name: 'Plus Jakarta Sans', data: decodeDataUri(jakarta600), weight: 600, style: 'normal' },
    { name: 'Plus Jakarta Sans', data: decodeDataUri(jakarta800), weight: 800, style: 'normal' },
  ]
  return fonts
}
