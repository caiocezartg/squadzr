import type { ReactNode } from 'react'

interface StatTileProps {
  readonly label: string
  /** The number, already formatted. */
  readonly value: string
  /** Marks a number read from live connections with the pulsing mint dot. */
  readonly live?: boolean
  /** The line under the number. */
  readonly children: ReactNode
}

/** The mint dot of a live number, its halo looping only when motion is allowed. */
function LiveDot() {
  return (
    <span aria-hidden="true" className="relative block size-2.25 shrink-0">
      <span className="border-mint motion-safe:animate-halo absolute -inset-0.5 rounded-full border-2 opacity-0" />
      <span className="bg-mint block size-full rounded-full shadow-[0_0_0_4px_rgba(0,255,162,0.14)]" />
    </span>
  )
}

/**
 * One of the Overview's numbers (reference, Admin panel, Overview): its label, the number, a line. The
 * tile spans three rows of the stats grid as a subgrid, so in a row of tiles a label that wraps to two
 * lines lowers every number in the row with it and the tiles keep one height.
 */
export function StatTile({ label, value, live = false, children }: StatTileProps) {
  return (
    <div className="bg-panel row-span-3 grid min-w-0 grid-rows-subgrid gap-0 px-5 py-4.5">
      <dt className="type-label text-muted self-end">{label}</dt>
      <dd className="mt-3 flex items-center gap-2.5 font-display text-[40px] leading-none font-extrabold tabular-nums sm:text-5xl">
        {live && <LiveDot />}
        {value}
      </dd>
      <dd className="text-muted mt-2 text-[12.5px] font-medium">{children}</dd>
    </div>
  )
}
