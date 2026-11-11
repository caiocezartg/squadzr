import satori, { init as initSatori } from 'satori/standalone'
import { Resvg, initWasm as initResvg } from '@resvg/resvg-wasm'
import { encode as encodeJpeg } from 'jpeg-js'
// Workers compile no WASM from bytes at runtime, so both binaries ship as precompiled modules.
import yogaWasm from 'satori/yoga.wasm?module'
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm?module'
import { SQUAD_PREVIEW_IMAGE_SIZE } from '@squadzr/schemas'
import { imageFonts } from './assets'
import { imageResponse } from './image-response'
import { SquadImage, type SquadImageInput } from './squad-image'

/** High enough that the text keeps clean edges; a typical image stays near 100 KB. */
const JPEG_QUALITY = 88

let ready: Promise<void> | undefined

/** Starts the layout engine and the rasterizer once per isolate; a failed start is tried again. */
function initRenderer(): Promise<void> {
  ready ??= Promise.all([initSatori(yogaWasm), initResvg(resvgWasm)]).then(
    () => undefined,
    (error: unknown) => {
      ready = undefined
      throw error
    }
  )
  return ready
}

/** Lays the picture out as SVG, rasterizes it and encodes it as a JPEG. */
async function renderJpeg(input: SquadImageInput): Promise<Uint8Array<ArrayBuffer>> {
  await initRenderer()
  const { width, height } = SQUAD_PREVIEW_IMAGE_SIZE

  const svg = await satori(<SquadImage {...input} />, { width, height, fonts: imageFonts() })
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: width } })
  const rendered = resvg.render()
  try {
    const jpeg = encodeJpeg(
      { data: rendered.pixels, width: rendered.width, height: rendered.height },
      JPEG_QUALITY
    )
    return new Uint8Array(jpeg.data)
  } finally {
    rendered.free()
    resvg.free()
  }
}

/** Renders one key as a 1200×630 JPEG response, cached as immutable. */
export async function renderSquadImage(input: SquadImageInput): Promise<Response> {
  return imageResponse(await renderJpeg(input))
}
