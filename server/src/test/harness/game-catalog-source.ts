import type {
  GameCatalogCandidate,
  IGameCatalogSource,
} from '@domain/services/game-catalog-source.interface'

/** A valid candidate with every field set; override only what the test cares about. */
export function createCandidate(
  overrides: Partial<GameCatalogCandidate> = {}
): GameCatalogCandidate {
  return {
    igdbId: 1001,
    name: 'League of Legends',
    slug: 'league-of-legends',
    genres: [{ slug: 'moba', name: 'MOBA' }],
    coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/lol.webp',
    thumbnailUrl: 'https://images.igdb.com/igdb/image/upload/t_thumb/lol.webp',
    multiplayer: { onlineCoopMax: null, onlineMax: 5 },
    popularity: 100,
    ...overrides,
  }
}

/** In-memory Game Catalog Source for the Catalog Import integration suite. */
export class FakeGameCatalogSource implements IGameCatalogSource {
  candidates: GameCatalogCandidate[] = []
  failure: Error | null = null
  calls = 0

  withCandidates(candidates: readonly GameCatalogCandidate[]): this {
    this.candidates = [...candidates]
    return this
  }

  failWith(error: Error): this {
    this.failure = error
    return this
  }

  async fetchCandidates(): Promise<GameCatalogCandidate[]> {
    this.calls += 1
    if (this.failure) throw this.failure
    return [...this.candidates]
  }
}
