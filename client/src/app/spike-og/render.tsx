import { ImageResponse } from 'next/og'
import bigShoulders800 from './fonts/BigShoulders-800.woff?inline'
import jakarta500 from './fonts/PlusJakartaSans-500.woff?inline'
import jakarta700 from './fonts/PlusJakartaSans-700.woff?inline'

export const SIZE = { width: 1200, height: 630 }

// SPIKE (#150): the fonts ship inside the Worker as data URIs, never fetched at render time.
function decode(dataUri: string): ArrayBuffer {
  const bytes = Uint8Array.from(atob(dataUri.slice(dataUri.indexOf(',') + 1)), (c) => c.charCodeAt(0))
  return bytes.buffer
}

let fonts: Array<{ name: string; data: ArrayBuffer; weight: 500 | 700 | 800; style: 'normal' }> | undefined

function loadFonts() {
  fonts ??= [
    { name: 'Big Shoulders', data: decode(bigShoulders800), weight: 800, style: 'normal' },
    { name: 'Plus Jakarta Sans', data: decode(jakarta500), weight: 500, style: 'normal' },
    { name: 'Plus Jakarta Sans', data: decode(jakarta700), weight: 700, style: 'normal' },
  ]
  return fonts
}

const COVERS = {
  full: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/coaczd.jpg',
  small: 'https://images.igdb.com/igdb/image/upload/t_cover_big/coaczd.jpg',
} as const

// SPIKE: tells the first render of an isolate (cold) from the later ones (warm).
let isolateId: string | undefined
let renders = 0

export type CoverVariant = keyof typeof COVERS | 'none' | 'floor'

export function renderSquadImage(code: string, cover: CoverVariant = 'full') {
  renders += 1
  isolateId ??= crypto.randomUUID().slice(0, 8)
  const headers = { 'cache-control': 'public, max-age=3600', 'x-spike-isolate': isolateId, 'x-spike-n': String(renders) }
  if (cover === 'floor') {
    // The renderer's floor: one font, one flat box of text, no image, no gradient.
    return new ImageResponse(
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#0b0f1a', color: '#fff', fontFamily: 'Plus Jakarta Sans', fontSize: 80 }}>
        {code}
      </div>,
      { ...SIZE, fonts: loadFonts().slice(1, 2), headers },
    )
  }
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: 'linear-gradient(135deg, #0b0f1a 0%, #1b1140 100%)',
          color: '#f4f4f8',
          fontFamily: 'Plus Jakarta Sans',
          padding: 64,
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 640 }}>
          <div style={{ display: 'flex', fontFamily: 'Big Shoulders', fontWeight: 800, fontSize: 44, letterSpacing: 4, color: '#a78bfa' }}>
            SQUADZR
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontFamily: 'Big Shoulders', fontWeight: 800, fontSize: 128, lineHeight: 1, textTransform: 'uppercase' }}>
              {`Squad ${code}`}
            </div>
            <div style={{ display: 'flex', fontWeight: 700, fontSize: 40, marginTop: 20 }}>Counter-Strike 2</div>
            <div style={{ display: 'flex', fontWeight: 500, fontSize: 30, marginTop: 12, color: '#c4c4d4' }}>
              3 of 5 players · Português · PC
            </div>
          </div>
          <div style={{ display: 'flex', fontWeight: 700, fontSize: 32, color: '#34d399' }}>2 spots left — jump in</div>
        </div>
        {cover === 'none' || cover === 'floor' ? null : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={COVERS[cover as keyof typeof COVERS]} width={400} height={502} style={{ borderRadius: 24, objectFit: 'cover', alignSelf: 'center' }} />
        )}
      </div>
    ),
    { ...SIZE, fonts: loadFonts(), headers },
  )
}
