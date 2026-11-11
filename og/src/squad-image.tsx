import type { ReactElement } from 'react'
import { SQUAD_PREVIEW_IMAGE_SIZE, type SquadPreviewKey } from '@squadzr/schemas'
import { LOGO_SRC } from './assets'
import type { CoverImages } from './cover'
import { imageCopy } from './copy'
import { slotLayout, SLOTS_WIDTH, type SlotLayout } from './slot-layout'
import { titleSize } from './title-size'

/** The landing preview's palette (client/og/landing-preview.html), plus the site's amber. */
const COLORS = {
  ground: '#07080a',
  text: '#f2f3f5',
  text2: '#c9cbd1',
  faint: '#5f626b',
  mint: '#00ffa2',
  amber: '#ffb547',
  card: '#121317',
} as const

const { width: WIDTH, height: HEIGHT } = SQUAD_PREVIEW_IMAGE_SIZE

/** The content stays in the middle 600px, so the image still reads when WhatsApp crops it to a square. */
const COLUMN = { left: 300, width: 600, top: 56, bottom: 56 } as const

/** What one image shows: the key, plus the game's name and cover. */
export interface SquadImageInput {
  readonly previewKey: SquadPreviewKey
  readonly gameName: string
  readonly cover: CoverImages
}

/**
 * One slot as the site draws it: filled is a mint ring with a person, open is a dashed ring with a "+".
 * A plain function, not a component: the renderer serializes SVG children as they are written.
 */
function slotShape(index: number, filled: boolean, layout: SlotLayout) {
  const step = layout.size + layout.gap
  const x = (index % layout.perRow) * step
  const y = Math.floor(index / layout.perRow) * step
  const { size, glyphs } = layout
  const stroke = Math.max(2, Math.round(size / 25))
  const center = size / 2
  const glyph = size * 0.45
  // The glyph's 24-unit box, scaled and centred in the slot.
  const glyphTransform = `translate(${center - glyph / 2} ${center - glyph / 2}) scale(${glyph / 24})`

  return (
    <g key={index} transform={`translate(${x} ${y})`}>
      <circle
        cx={center}
        cy={center}
        r={(size - stroke) / 2}
        fill={filled ? 'rgba(0, 255, 162, 0.1)' : COLORS.card}
        stroke={filled ? COLORS.mint : 'rgba(201, 203, 209, 0.6)'}
        strokeWidth={stroke}
        strokeDasharray={filled ? undefined : `${stroke * 2.4} ${stroke * 1.6}`}
      />
      {glyphs && filled ? (
        <g transform={glyphTransform} fill={COLORS.mint}>
          <circle cx="12" cy="8" r="4.5" />
          <path d="M3.5 21a8.5 8.5 0 0 1 17 0z" />
        </g>
      ) : null}
      {glyphs && !filled ? (
        <g
          transform={glyphTransform}
          fill="none"
          stroke="rgba(201, 203, 209, 0.75)"
          strokeWidth="3"
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </g>
      ) : null}
    </g>
  )
}

/**
 * Every slot in one SVG. A rounded, bordered box per slot, or an SVG per slot, costs the rasterizer
 * several times more: each becomes its own nested image.
 */
function Slots({ filled, total }: { filled: number; total: number }) {
  const layout = slotLayout(total)
  const rows = Math.ceil(total / layout.perRow)
  const height = rows * layout.size + (rows - 1) * layout.gap
  return (
    <svg width={SLOTS_WIDTH} height={height} viewBox={`0 0 ${SLOTS_WIDTH} ${height}`}>
      {Array.from({ length: total }, (_, index) => slotShape(index, index < filled, layout))}
    </svg>
  )
}

/** The cover backdrop covers the right part of the image, behind the box art. */
const BACKDROP = { left: 560, width: WIDTH - 560 } as const

/**
 * The game's cover behind the box art, dimmed and faded into the ground, under the landing's two glows.
 * The source is IGDB's 35px micro cover, so stretching it blurs it: a blur filter, or a backdrop over the whole
 * width, would cost the rasterizer a large share of the render.
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
          left: BACKDROP.left,
          top: Math.round((HEIGHT - height) / 2),
          opacity: 0.35,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: BACKDROP.left,
          top: 0,
          width: 280,
          height: HEIGHT,
          display: 'flex',
          backgroundImage: `linear-gradient(90deg, ${COLORS.ground}, rgba(7, 8, 10, 0))`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          backgroundImage: `linear-gradient(90deg, ${COLORS.ground} 0%, rgba(7, 8, 10, 0.86) 45%, rgba(7, 8, 10, 0.55) 100%)`,
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

const TILE = { left: 934, top: 150, width: 224, height: 299 } as const

/**
 * The cover as tilted box art, in the right margin. Its shadow is a darker card behind it: a blurred
 * shadow would cost the rasterizer about as much as the rest of the image.
 */
function BoxArt({ cover }: { cover: string }) {
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: TILE.left + 6,
          top: TILE.top + 18,
          width: TILE.width + 6,
          height: TILE.height + 6,
          display: 'flex',
          transform: 'rotate(6deg)',
          borderRadius: 20,
          background: 'rgba(0, 0, 0, 0.45)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: TILE.left,
          top: TILE.top,
          display: 'flex',
          transform: 'rotate(6deg)',
          borderRadius: 18,
          border: '3px solid rgba(242, 243, 245, 0.14)',
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
          top: COLUMN.top,
          bottom: COLUMN.bottom,
          width: COLUMN.width,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <img alt="Squadzr" src={LOGO_SRC} width={182} height={48} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginTop: 40,
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
            marginTop: 14,
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
        <div style={{ display: 'flex', marginTop: 20, fontSize: 32, color: COLORS.amber }}>
          {copy.openSpots}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 'auto',
          }}
        >
          <Slots filled={filled} total={total} />
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
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
