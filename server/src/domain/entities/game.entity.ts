export interface Game {
  readonly id: string
  readonly name: string
  readonly slug: string
  readonly coverUrl: string
  readonly minPlayers: number
  readonly maxPlayers: number
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface CreateGameInput {
  readonly name: string
  readonly slug: string
  readonly coverUrl: string
  readonly minPlayers: number
  readonly maxPlayers: number
}
