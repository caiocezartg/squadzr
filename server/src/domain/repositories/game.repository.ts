import type { CreateGameInput, Game } from '@domain/entities/game.entity'

export interface SearchGamesInput {
  /** The player's text; empty or absent lists the most popular Listed Games. */
  readonly search?: string
  /** The maximum number of games to return. */
  readonly limit: number
}

export interface IGameRepository {
  findById(id: string): Promise<Game | null>
  findAll(): Promise<Game[]>
  /** Listed Games only: name contains `search`, prefix matches first, then popularity. */
  search(input: SearchGamesInput): Promise<Game[]>
  upsertBySlug(input: CreateGameInput): Promise<Game>
}
