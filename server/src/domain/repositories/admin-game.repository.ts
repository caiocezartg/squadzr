import type { AdminGameSort, AdminGameStatus } from '@squadzr/schemas'
import type {
  AdminGame,
  AdminGameChange,
  AdminGameCounts,
} from '@domain/entities/admin-game.entity'

export interface ListAdminGamesQuery {
  /** How the page is ordered; every order ends on the Game id, so pages never repeat or skip a row. */
  readonly sort: AdminGameSort
  readonly status: AdminGameStatus
  readonly offset: number
  readonly limit: number
  /** Matches the name or an alias, ignoring case, accents and punctuation; blank or absent is no filter. */
  readonly search?: string
}

export interface AdminGamePage {
  readonly games: AdminGame[]
  /** Every Game that matches, not only this page's. */
  readonly total: number
}

/** The instants a Catalog Import Run started and finished. */
export interface ImportWindow {
  readonly from: Date
  readonly to: Date
}

export interface AdminGameChanges {
  /** Games created inside the window. */
  readonly entered: AdminGameChange
  /** Games that are delisted and were last changed inside the window. */
  readonly left: AdminGameChange
}

/** The admin Catalog's read side over the Games: every Game, listed or not, with its usage. */
export interface IAdminGameRepository {
  list(query: ListAdminGamesQuery): Promise<AdminGamePage>
  /** The Game with that id, listed or not, or null when it is unknown. */
  findById(id: string): Promise<AdminGame | null>
  count(): Promise<AdminGameCounts>
  /** The Games that entered and left the catalog inside the window; each lists at most `nameLimit` names. */
  findChanges(window: ImportWindow, nameLimit: number): Promise<AdminGameChanges>
}
