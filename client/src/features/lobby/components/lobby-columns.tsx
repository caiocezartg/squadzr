import type { ReactNode } from 'react'

interface LobbyColumnsProps {
  /** The cover, which takes the room the members column leaves. */
  readonly cover: ReactNode
  /** The members panel and the invite under it. */
  readonly children: ReactNode
}

/**
 * The Lobby's two columns (reference, Lobby): the cover beside the members column from `lg`. The members
 * column is about three fifths of the row from `xl` and stops at 40rem, so on a big screen the extra room
 * goes to the cover and the members panel and the invite under it never stretch. Below `lg` they stack.
 */
export function LobbyColumns({ cover, children }: LobbyColumnsProps) {
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch">
      {cover}
      <div className="flex min-w-0 flex-1 flex-col gap-5 xl:max-w-160 xl:flex-none xl:basis-[58%]">
        {children}
      </div>
    </div>
  )
}
