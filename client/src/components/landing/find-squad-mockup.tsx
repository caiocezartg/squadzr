'use client'

import { ArrowRight, Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { pickAvatarColors } from '@/components/ds/avatar-colors'
import { coverUrl } from './hero-showcase-data'
import { JoinFlash, Pointer, type MockupProps, type Point } from './how-it-works-mockup-parts'
import { useMockupTimeline } from './use-mockup-timeline'

/** The query the search types, one character per beat. */
const QUERY = 'valorant'

/**
 * 1 the search takes focus · 2–9 "valorant" is typed · 10 the results swap to Valorant squads · 11 the
 * pointer reaches the first one · 12 hovers it: its count gives way to "Join" · 13 presses it · 14 the
 * visitor takes a slot in it.
 */
const FIND_CUES = [
  300, 500, 570, 640, 710, 780, 850, 920, 990, 1150, 1500, 2050, 2550, 2700,
] as const

const FIND_POINTER: Record<'rest' | 'join', Point> = {
  rest: { x: 340, y: 270 },
  join: { x: 318, y: 94 },
}

interface SquadRow {
  readonly id: string
  readonly game: string
  readonly name: string
  readonly coverId: string
  readonly members: readonly string[]
  readonly size: number
}

/** What the board shows before the search: other games' squads (the hero's own covers). */
const BOARD_ROWS: readonly SquadRow[] = [
  {
    id: 'apex',
    game: 'APEX LEGENDS',
    name: 'Trio ranked até Diamante',
    coverId: 'cocqh2',
    members: ['rx-1', 'vt-9'],
    size: 3,
  },
  {
    id: 'lol',
    game: 'LEAGUE OF LEGENDS',
    name: 'Flex de sexta, sem tilt',
    coverId: 'coc99o',
    members: ['th-5', 'ps-2', 'an-8'],
    size: 5,
  },
  {
    id: 'lethal',
    game: 'LETHAL COMPANY',
    name: 'Cota batida antes da meia-noite',
    coverId: 'co5ive',
    members: ['dn-3'],
    size: 4,
  },
]

/** What the search for "valorant" finds. The first one is the Squad the visitor joins. */
const VALORANT_ROWS: readonly SquadRow[] = [
  {
    id: 'premier',
    game: 'VALORANT',
    name: 'Premier quinta à noite',
    coverId: 'cocqbp',
    members: ['mf-7', 'br-0'],
    size: 5,
  },
  {
    id: 'unrated',
    game: 'VALORANT',
    name: 'Unrated sem tilt',
    coverId: 'cocqbp',
    members: ['kz-9'],
    size: 5,
  },
  {
    id: 'ranked',
    game: 'VALORANT',
    name: 'Ranked até Imortal',
    coverId: 'cocqbp',
    members: ['gb-6', 'mk-1', 'jn-3', 'ps-2'],
    size: 5,
  },
]

/** The visitor, who takes the first open slot of the Squad they join. */
const VISITOR_ID = 'cc-2'

type RowState = 'idle' | 'hover' | 'pressed' | 'joined'

interface ResultRowProps {
  readonly row: SquadRow
  /** The Squad the visitor joins; only it carries the call to join and the joined mark. */
  readonly target: boolean
  readonly state: RowState
  readonly live: boolean
  readonly dimmed: boolean
}

/**
 * One squad of the board's results, compact: the cover, game, name, the members' rail and the count. On
 * hover the count gives way to the call to join, as the board's squad card does (reference, Per element).
 */
function ResultRow({ row, target, state, live, dimmed }: ResultRowProps) {
  const t = useTranslations('landing.howItWorks')
  const joined = state === 'joined'
  const engaged = state !== 'idle'
  const open = row.size - row.members.length

  return (
    <span
      data-pressed={state === 'pressed' ? '' : undefined}
      data-dimmed={dimmed ? '' : undefined}
      className="bg-raised relative flex items-center gap-2.5 p-1.5 transition-[opacity,scale] duration-150 ease-(--ease-out) data-dimmed:opacity-40 data-pressed:scale-[0.985]"
    >
      <img
        src={coverUrl(row.coverId)}
        alt=""
        decoding="async"
        className="bg-raised-2 block h-11.5 w-8.5 shrink-0 object-cover"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.75">
        <span className="font-ds-mono text-text-3 truncate text-[9.5px] font-bold tracking-[0.12em]">
          {row.game} · PT-BR
        </span>
        <span className="text-text truncate text-[13px] font-extrabold">{row.name}</span>
      </span>
      {/* At 18px each member is their colour alone, with no initials. */}
      <span className="flex shrink-0">
        {row.members.map((id) => (
          <span
            key={id}
            className="ring-raised -ml-1.25 block size-4.5 rounded-full ring-2 first:ml-0"
            style={{ backgroundColor: pickAvatarColors(id).background }}
          />
        ))}
        {Array.from({ length: open }, (_, slot) => (
          <span
            key={slot}
            className="ring-raised relative -ml-1.25 block size-4.5 rounded-full bg-[#2a2b31] ring-2"
          >
            {slot === 0 && joined && (
              <span
                className="ring-mint absolute inset-0 block rounded-full ring-[1.5px]"
                style={{ backgroundColor: pickAvatarColors(VISITOR_ID).background }}
              >
                {live && <JoinFlash />}
              </span>
            )}
          </span>
        ))}
      </span>
      {/* The count; in its place on hover the call to join, then the joined mark. */}
      <span className="relative block h-5 w-22 shrink-0 whitespace-nowrap">
        <span
          data-gone={engaged ? '' : undefined}
          className="text-text-2 absolute inset-0 flex items-center justify-end text-[12px] font-extrabold tabular-nums transition-opacity duration-200 ease-(--ease-out) data-gone:opacity-0"
        >
          {row.members.length}/{row.size}
        </span>
        {target && (
          <>
            <span
              data-shown={engaged && !joined ? '' : undefined}
              className="text-mint absolute inset-0 flex translate-x-2.5 items-center justify-end gap-1 text-[12px] font-extrabold opacity-0 transition-[opacity,translate] duration-[200ms,250ms] ease-(--ease-out) data-shown:translate-x-0 data-shown:opacity-100"
            >
              {t('mockup.join')}
              <ArrowRight className="size-3.25" strokeWidth={2.8} />
            </span>
            <span
              data-shown={joined ? '' : undefined}
              className="text-mint absolute inset-0 flex items-center justify-end gap-1 text-[11.5px] font-extrabold opacity-0 transition-opacity duration-200 ease-(--ease-out) data-shown:opacity-100"
            >
              <Check className="size-3.25" strokeWidth={3} />
              {t('mockup.joined')}
            </span>
          </>
        )}
      </span>
      <span
        data-shown={engaged ? '' : undefined}
        className="pointer-events-none absolute inset-0 opacity-0 shadow-[inset_0_0_0_1.5px_var(--color-mint)] transition-opacity duration-200 ease-(--ease-out) data-shown:opacity-100"
      />
    </span>
  )
}

function rowState(beat: number): RowState {
  if (beat >= 14) return 'joined'
  if (beat === 13) return 'pressed'
  if (beat === 12) return 'hover'
  return 'idle'
}

export function FindSquadMockup({ mode }: MockupProps) {
  const t = useTranslations('landing.howItWorks')
  const { beat, live } = useMockupTimeline(FIND_CUES, mode)
  const typed = Math.min(QUERY.length, Math.max(0, beat - 1))
  const found = beat >= 10
  const rows = found ? VALORANT_ROWS : BOARD_ROWS

  return (
    <div className="bg-card relative flex size-full flex-col gap-2 overflow-hidden px-4 pt-6">
      <span className="flex gap-1.5">
        <span
          data-focused={beat >= 1 ? '' : undefined}
          className="bg-raised-2 data-focused:shadow-[inset_0_0_0_1.5px_var(--color-mint)] flex h-9.5 min-w-0 flex-1 items-center gap-2 px-3 shadow-[inset_0_0_0_1.5px_transparent] transition-shadow duration-200 ease-(--ease-out)"
        >
          <svg
            aria-hidden="true"
            className="shrink-0"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-ds-muted)"
            strokeWidth="2.6"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <span className="flex min-w-0 items-center">
            {typed > 0 ? (
              <span className="font-ds-mono text-text text-[13px] font-semibold whitespace-nowrap">
                {QUERY.slice(0, typed)}
              </span>
            ) : (
              <span className="text-ds-muted truncate text-[12px] font-medium">
                {t('mockup.searchPlaceholder')}
              </span>
            )}
            {beat >= 1 && beat < 10 && (
              <span className="bg-mint ml-px block h-3.75 w-[1.5px] shrink-0" />
            )}
          </span>
        </span>
        <span className="bg-raised-2 text-text flex h-9.5 items-center gap-1.5 px-2.75 text-xs font-bold">
          {t('mockup.filters')}
          <span className="bg-mint text-mint-ink px-1.25 py-px text-[10px] font-extrabold">2</span>
        </span>
      </span>
      {rows.map((row, index) => (
        <ResultRow
          key={row.id}
          row={row}
          target={found && index === 0}
          state={found && index === 0 ? rowState(beat) : 'idle'}
          live={live}
          dimmed={!found && typed > 0}
        />
      ))}
      <Pointer
        at={beat >= 11 ? FIND_POINTER.join : FIND_POINTER.rest}
        shown={beat >= 11 && beat < 14}
        pressed={beat === 13}
      />
    </div>
  )
}
