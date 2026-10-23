import { performance } from 'node:perf_hooks'
import type { Game, UpsertGameInput } from '@domain/entities/game.entity'
import type { IGameRepository } from '@domain/repositories/game.repository'
import type {
  GameCatalogCandidate,
  IGameCatalogSource,
} from '@domain/services/game-catalog-source.interface'

/** No Squad can exceed 40 players; larger capacities are lobby sizes, not squads. */
const MAX_SQUAD_SIZE = 40
const FALLBACK_MIN_PLAYERS = 2
const FALLBACK_MAX_PLAYERS = 5

/** A hand-picked game: squad size and featured placement win over the source data. */
export interface CuratedGame {
  readonly igdbId: number
  readonly name: string
  readonly minPlayers: number
  readonly maxPlayers: number
  readonly featuredRank: number | null
}

/** Safety limits of one run, injected by the factory so tests can pin them. */
export interface CatalogImportSafety {
  /** Minimum share of today's Listed Games the candidates must reach. */
  readonly minimumRetainedFraction: number
  /** Absolute minimum number of candidates, which also covers the first run. */
  readonly minimumCandidates: number
}

export interface CatalogImportInput {
  /** Bypasses only the fraction check; the absolute floor always applies. */
  readonly overrideFractionCheck?: boolean
}

/** One structured result of a run, logged by the entry function. */
export interface CatalogImportSummary {
  readonly created: number
  readonly updated: number
  readonly delisted: number
  readonly relisted: number
  /** Candidates returned by the source, duplicates included. */
  readonly received: number
  /** Candidates ignored because their IGDB id repeated within the run. */
  readonly dropped: number
  readonly durationMs: number
}

export interface ICatalogImportUseCase {
  execute(input?: CatalogImportInput): Promise<CatalogImportSummary>
}

export type CatalogImportSafetyStop = 'below_fraction' | 'below_floor'

export class CatalogImportSafetyError extends Error {
  constructor(
    readonly stop: CatalogImportSafetyStop,
    message: string
  ) {
    super(message)
    this.name = 'CatalogImportSafetyError'
  }
}

interface SquadSize {
  readonly minPlayers: number
  readonly maxPlayers: number
}

type ImportedGame = Game & { readonly igdbId: number }

function isImportedGame(game: Game): game is ImportedGame {
  return game.igdbId !== null
}

/** Keeps the first candidate per IGDB id; later duplicates are dropped. */
function dedupeCandidates(candidates: readonly GameCatalogCandidate[]): {
  unique: GameCatalogCandidate[]
  dropped: number
} {
  const byIgdbId = new Map<number, GameCatalogCandidate>()
  for (const candidate of candidates) {
    if (!byIgdbId.has(candidate.igdbId)) byIgdbId.set(candidate.igdbId, candidate)
  }

  return { unique: [...byIgdbId.values()], dropped: candidates.length - byIgdbId.size }
}

/**
 * Curated squad sizes win and their maximum is clamped to 40. Otherwise the
 * largest online capacity between 2 and 40 becomes the maximum, with a minimum
 * of 2. Everything else (unknown, 0/1 players, or a lobby above 40) is 2-5.
 */
export function resolveSquadSize(
  candidate: GameCatalogCandidate,
  curated: CuratedGame | undefined
): SquadSize {
  if (curated) {
    return {
      minPlayers: curated.minPlayers,
      maxPlayers: Math.min(curated.maxPlayers, MAX_SQUAD_SIZE),
    }
  }

  const onlineCapacity = Math.max(
    candidate.multiplayer.onlineCoopMax ?? 0,
    candidate.multiplayer.onlineMax ?? 0
  )
  if (onlineCapacity >= 2 && onlineCapacity <= MAX_SQUAD_SIZE) {
    return { minPlayers: FALLBACK_MIN_PLAYERS, maxPlayers: onlineCapacity }
  }

  return { minPlayers: FALLBACK_MIN_PLAYERS, maxPlayers: FALLBACK_MAX_PLAYERS }
}

function toUpsertInput(
  candidate: GameCatalogCandidate,
  curated: CuratedGame | undefined
): UpsertGameInput {
  const squadSize = resolveSquadSize(candidate, curated)

  return {
    igdbId: candidate.igdbId,
    name: candidate.name,
    slug: candidate.slug,
    genres: candidate.genres,
    coverUrl: candidate.coverUrl,
    thumbnailUrl: candidate.thumbnailUrl,
    popularity: candidate.popularity,
    minPlayers: squadSize.minPlayers,
    maxPlayers: squadSize.maxPlayers,
    featuredRank: curated?.featuredRank ?? null,
  }
}

/**
 * One Catalog Import run: fetch every candidate, then decide whether the
 * catalog survives the swap and upsert, delist and relist inside one locked
 * transaction. Anything that throws leaves the catalog exactly as it was.
 */
export class CatalogImportUseCase implements ICatalogImportUseCase {
  constructor(
    private readonly source: IGameCatalogSource,
    private readonly gameRepository: IGameRepository,
    private readonly curatedGames: readonly CuratedGame[],
    private readonly safety: CatalogImportSafety
  ) {}

  async execute(input: CatalogImportInput = {}): Promise<CatalogImportSummary> {
    const startedAt = performance.now()
    const received = await this.source.fetchCandidates()
    const { unique: candidates, dropped } = dedupeCandidates(received)

    const curatedByIgdbId = new Map(this.curatedGames.map((game) => [game.igdbId, game]))
    const candidateIds = new Set(candidates.map((candidate) => candidate.igdbId))

    const changes = await this.gameRepository.runInTransaction(async (repository) => {
      // Wait for any concurrent run, then read once: the safety check and the
      // delist/relist sets describe the same catalog the writes replace.
      await repository.acquireCatalogImportLock()
      const existingGames = await repository.findAll()
      this.assertCatalogSurvives(
        candidates.length,
        existingGames.filter((game) => game.listed).length,
        input.overrideFractionCheck ?? false
      )

      const existingImportedGames = existingGames.filter(isImportedGame)
      const existingByIgdbId = new Map(
        existingImportedGames.map((game) => [game.igdbId, game] as const)
      )

      let created = 0
      let updated = 0
      for (const candidate of candidates) {
        await repository.upsertByIgdbId(
          toUpsertInput(candidate, curatedByIgdbId.get(candidate.igdbId))
        )
        if (existingByIgdbId.has(candidate.igdbId)) updated += 1
        else created += 1
      }

      // Only imported rows carry an IGDB id, so legacy rows can never enter
      // either list and stay untouched by delisting and relisting.
      const delistIds = existingImportedGames
        .filter((game) => game.listed && !candidateIds.has(game.igdbId))
        .map((game) => game.igdbId)
      const relistIds = existingImportedGames
        .filter((game) => !game.listed && candidateIds.has(game.igdbId))
        .map((game) => game.igdbId)

      const delisted = await repository.delistByIgdbIds(delistIds)
      const relisted = await repository.relistByIgdbIds(relistIds)

      return { created, updated, delisted, relisted }
    })

    return {
      ...changes,
      received: received.length,
      dropped,
      durationMs: performance.now() - startedAt,
    }
  }

  /**
   * Fails before any write when the candidates cannot sustain today's catalog.
   * Call it inside the locked transaction, with the Listed Games count read from
   * the same snapshot as the writes.
   */
  private assertCatalogSurvives(
    candidateCount: number,
    listedCount: number,
    overrideFractionCheck: boolean
  ): void {
    if (candidateCount < this.safety.minimumCandidates) {
      throw new CatalogImportSafetyError(
        'below_floor',
        `Catalog Import received ${candidateCount} candidates, below the absolute floor of ${this.safety.minimumCandidates}`
      )
    }

    const minimumFromToday = listedCount * this.safety.minimumRetainedFraction
    if (!overrideFractionCheck && candidateCount < minimumFromToday) {
      throw new CatalogImportSafetyError(
        'below_fraction',
        `Catalog Import received ${candidateCount} candidates, below ${this.safety.minimumRetainedFraction * 100}% of today's ${listedCount} Listed Games`
      )
    }
  }
}
