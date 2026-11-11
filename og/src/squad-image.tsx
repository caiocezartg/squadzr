import type { ReactElement } from 'react'
import { SQUAD_PREVIEW_IMAGE_SIZE, avatarRail, type SquadPreviewKey } from '@squadzr/schemas'
import { LOGO_SRC } from './assets'
import type { CoverImages } from './cover'
import { imageCopy } from './copy'
import { titleSize } from './title-size'

/** The landing preview's palette (client/og/landing-preview.html), plus the site's amber. */
const COLORS = {
  ground: '#07080a',
  text: '#f2f3f5',
  text2: '#c9cbd1',
  text3: '#a9abb3',
  faint: '#5f626b',
  mint: '#00ffa2',
  amber: '#ffb547',
  card: '#121317',
} as const

const { width: WIDTH, height: HEIGHT } = SQUAD_PREVIEW_IMAGE_SIZE

/**
 * The image uses its full width, the wide card Discord, X and WhatsApp show: the box art on the left and
 * the text on the right, inside symmetric 84px margins. A square crop of the centre keeps the game name
 * and the slots readable, if not whole.
 */
const MARGIN = 84

/** The cover as box art, vertically centred in the left margin. */
const TILE = { left: MARGIN, width: 270, height: 360, top: (HEIGHT - 360) / 2 } as const

/** The text column, from the box art to the right margin. */
const COLUMN = {
  left: TILE.left + TILE.width + 76,
  right: MARGIN,
  top: 70,
  bottom: 70,
} as const

/** What one image shows: the key, plus the game's name and cover. */
export interface SquadImageInput {
  readonly previewKey: SquadPreviewKey
  readonly gameName: string
  readonly cover: CoverImages
}

/** The rail's circles: five of them, the `+N` and a two-digit count fit the text column. */
const RAIL = { size: 68, gap: 12 } as const

/**
 * One circle of the rail as the site draws it: filled is a mint ring with a person, open is a dashed ring
 * with a "+". A plain function, not a component: the renderer serializes SVG children as they are written.
 */
function railCircle(index: number, filled: boolean) {
  const { size, gap } = RAIL
  const stroke = Math.max(2, Math.round(size / 25))
  const center = size / 2
  const glyph = size * 0.45
  // The glyph's 24-unit box, scaled and centred in the circle.
  const glyphTransform = `translate(${center - glyph / 2} ${center - glyph / 2}) scale(${glyph / 24})`

  return (
    <g key={index} transform={`translate(${index * (size + gap)} 0)`}>
      <circle
        cx={center}
        cy={center}
        r={(size - stroke) / 2}
        fill={filled ? 'rgba(0, 255, 162, 0.1)' : COLORS.card}
        stroke={filled ? COLORS.mint : 'rgba(201, 203, 209, 0.6)'}
        strokeWidth={stroke}
        strokeDasharray={filled ? undefined : `${stroke * 2.4} ${stroke * 1.6}`}
      />
      {filled ? (
        <g transform={glyphTransform} fill={COLORS.mint}>
          <circle cx="12" cy="8" r="4.5" />
          <path d="M3.5 21a8.5 8.5 0 0 1 17 0z" />
        </g>
      ) : (
        <g
          transform={glyphTransform}
          fill="none"
          stroke="rgba(201, 203, 209, 0.75)"
          strokeWidth="3"
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </g>
      )}
    </g>
  )
}

/**
 * The Squad's rail, by the site's rule (`avatarRail` in `@squadzr/schemas`, as the Squad card draws it):
 * at most five circles, filled first, then `+N` in the mono face for the slots past them. The circles
 * are one SVG: an SVG or a bordered box per circle costs the rasterizer several times more.
 */
function Rail({ filled, total }: { filled: number; total: number }) {
  const { slots, extra } = avatarRail(filled, total)
  const width = slots.length * RAIL.size + (slots.length - 1) * RAIL.gap

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <svg width={width} height={RAIL.size} viewBox={`0 0 ${width} ${RAIL.size}`}>
        {slots.map((slot, index) => railCircle(index, slot.kind !== 'vacant'))}
      </svg>
      {extra > 0 ? (
        <div
          style={{
            display: 'flex',
            marginLeft: 20,
            fontFamily: 'JetBrains Mono',
            fontWeight: 700,
            fontSize: 30,
            color: COLORS.text3,
          }}
        >
          {`+${extra}`}
        </div>
      ) : null}
    </div>
  )
}

/** The blurred cover covers the left part of the image, behind the box art, and fades into the ground. */
const BACKDROP = { width: 760, fadeFrom: 460 } as const

/**
 * The game's cover behind the box art, dimmed and faded into the ground, under the landing's two glows.
 * The source is IGDB's 35px micro cover, so stretching it blurs it: a blur filter, or a backdrop over the
 * whole width, would cost the rasterizer a large share of the render.
 */
function Backdrop({ cover }: { cover: string }) {
  const height = Math.round((BACKDROP.width * 4) / 3)
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
      <img
        alt=""
        src={cover}
        width={BACKDROP.width}
        height={height}
        style={{
          position: 'absolute',
          left: 0,
          top: Math.round((HEIGHT - height) / 2),
          opacity: 0.35,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: BACKDROP.fadeFrom,
          top: 0,
          width: BACKDROP.width - BACKDROP.fadeFrom,
          height: HEIGHT,
          display: 'flex',
          backgroundImage: `linear-gradient(90deg, rgba(7, 8, 10, 0), ${COLORS.ground})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          backgroundImage: `linear-gradient(90deg, rgba(7, 8, 10, 0.55) 0%, rgba(7, 8, 10, 0.86) 55%, ${COLORS.ground} 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          backgroundImage:
            'radial-gradient(circle at 92% 6%, rgba(0, 255, 162, 0.2), rgba(0, 255, 162, 0) 45%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          backgroundImage:
            'radial-gradient(circle at 8% 98%, rgba(78, 90, 232, 0.26), rgba(78, 90, 232, 0) 48%)',
        }}
      />
    </div>
  )
}

/**
 * The cover as tilted box art on the left. Its shadow is a darker card behind it: a blurred shadow would
 * cost the rasterizer about as much as the rest of the image.
 */
function BoxArt({ cover }: { cover: string }) {
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: TILE.left + 10,
          top: TILE.top + 16,
          width: TILE.width + 6,
          height: TILE.height + 6,
          display: 'flex',
          transform: 'rotate(-4deg)',
          borderRadius: 22,
          background: 'rgba(0, 0, 0, 0.5)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: TILE.left,
          top: TILE.top,
          display: 'flex',
          transform: 'rotate(-4deg)',
          borderRadius: 20,
          border: '3px solid rgba(242, 243, 245, 0.16)',
          overflow: 'hidden',
        }}
      >
        <img alt="" src={cover} width={TILE.width} height={TILE.height} />
      </div>
    </>
  )
}

/** The whole picture of one key. */
export function SquadImage({ previewKey, gameName, cover }: SquadImageInput): ReactElement {
  const { filled, total, language } = previewKey
  const copy = imageCopy(language, filled, total)
  const nameSize = titleSize(gameName)

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        width: WIDTH,
        height: HEIGHT,
        background: COLORS.ground,
        color: COLORS.text,
        fontFamily: 'Plus Jakarta Sans',
        fontWeight: 600,
      }}
    >
      <Backdrop cover={cover.backdrop} />
      <BoxArt cover={cover.tile} />
      <div
        style={{
          position: 'absolute',
          left: COLUMN.left,
          right: COLUMN.right,
          top: COLUMN.top,
          bottom: COLUMN.bottom,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <img alt="Squadzr" src={LOGO_SRC} width={167} height={44} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginTop: 34,
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: 3,
            textTransform: 'uppercase',
            color: COLORS.mint,
          }}
        >
          <div
            style={{
              display: 'flex',
              width: 12,
              height: 12,
              borderRadius: 12,
              marginRight: 14,
              background: COLORS.mint,
              boxShadow: '0 0 16px rgba(0, 255, 162, 0.8)',
            }}
          />
          {copy.kicker}
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 12,
            maxHeight: nameSize * 0.92 * 2,
            overflow: 'hidden',
            fontFamily: 'Big Shoulders',
            fontWeight: 900,
            fontSize: nameSize,
            lineHeight: 0.92,
            textTransform: 'uppercase',
          }}
        >
          {gameName}
        </div>
        <div style={{ display: 'flex', marginTop: 18, fontSize: 32, color: COLORS.amber }}>
          {copy.status}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 'auto',
          }}
        >
          <Rail filled={filled} total={total} />
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              marginLeft: 32,
              fontFamily: 'Big Shoulders',
              fontWeight: 900,
              fontSize: 72,
              lineHeight: 1,
            }}
          >
            <span style={{ color: COLORS.mint }}>{filled}</span>
            <span style={{ color: COLORS.faint }}>/{total}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
