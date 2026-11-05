import type { ReactNode } from 'react'

interface UserSquadRowProps {
  readonly coverUrl: string
  readonly name: ReactNode
  readonly meta: string
  /** What sits at the row's right: a code, a date. */
  readonly end: ReactNode
}

/** One Squad on a person's page: the game's poster, the name with its details, and a value at the right. */
export function UserSquadRow({ coverUrl, name, meta, end }: UserSquadRowProps) {
  return (
    <span className="flex items-center gap-3">
      <img src={coverUrl} alt="" className="bg-raised-2 block h-10 w-7.5 shrink-0 object-cover" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-text text-sm font-extrabold break-words">{name}</span>
        <span className="text-muted text-xs font-medium">{meta}</span>
      </span>
      <span className="shrink-0">{end}</span>
    </span>
  )
}
