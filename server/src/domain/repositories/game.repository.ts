import type { Game } from '@domain/entities/game.entity'

export interface IGameRepository {
  findById(id: string): Promise<Game | null>
  findAll(): Promise<Game[]>
}
