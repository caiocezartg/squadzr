import { z } from 'zod'
import type { ApiClient } from './api-client'
import type { Player } from './data-commands'
import type { RunOptions } from './options'
import { RequestRecorder, type RequestSummary } from './stats'
import type { FleetSummary, SocketFleet } from './socket-fleet'

const gamesSchema = z.object({
  games: z.array(z.object({ id: z.string(), platforms: z.array(z.string()).default([]) })).min(1),
})
const createdSchema = z.object({ room: z.object({ code: z.string().length(6) }) })

/** Every other Squad is made to fill up (and become Ready, which writes a Squad Record); the rest stay open. */
const FILLING_SQUAD_SIZE = 2
const OPEN_SQUAD_SIZE = 4
const TICK_MS = 100

export interface RunReport {
  readonly players: number
  readonly sockets: FleetSummary
  readonly setup: { readonly create: RequestSummary; readonly join: RequestSummary }
  readonly board: RequestSummary
  readonly minOpenDuringBoard: number
  readonly squadsCreated: number
  readonly squadsReady: number
  readonly mitigated: number
  readonly abortedFor: string | null
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Starts `task` for each item, `perSecond` of them every second, and resolves when all are done. */
export async function paced<T>(
  items: readonly T[],
  perSecond: number,
  task: (item: T) => Promise<void>,
  stopped: () => boolean
): Promise<void> {
  const running: Promise<void>[] = []
  const started = performance.now()
  for (const [index, item] of items.entries()) {
    if (stopped()) break
    const wait = started + (index * 1000) / perSecond - performance.now()
    if (wait > 0) await sleep(wait)
    running.push(task(item))
  }
  await Promise.all(running)
}

export class Scenario {
  private readonly create = new RequestRecorder()
  private readonly join = new RequestRecorder()
  private readonly board = new RequestRecorder()
  private squadsCreated = 0
  private squadsReady = 0
  private mitigated = 0
  private minOpen = Number.POSITIVE_INFINITY
  private abortedFor: string | null = null

  constructor(
    private readonly options: RunOptions,
    private readonly api: ApiClient,
    private readonly fleet: SocketFleet,
    private readonly players: readonly Player[],
    private readonly stopped: () => boolean
  ) {}

  async run(): Promise<RunReport> {
    await paced(
      this.players,
      this.options.rampPerSecond,
      async (p) => void (await this.fleet.connect(p)),
      this.stopped
    )
    const game = await this.pickGame()
    const pairs = this.pairs()
    await paced(
      pairs,
      this.options.rampPerSecond,
      (pair) => this.makeSquad(game, pair),
      this.stopped
    )
    await this.readBoard()
    return this.report()
  }

  private pairs(): [number, Player, Player | undefined][] {
    const result: [number, Player, Player | undefined][] = []
    for (let i = 0; i < this.players.length; i += 2) {
      const host = this.players[i]
      if (host) result.push([i / 2, host, this.players[i + 1]])
    }
    return result
  }

  private async pickGame(): Promise<{ id: string; platform: string | null }> {
    const response = await this.api.request('GET', '/api/games', { player: this.players[0] })
    const parsed = gamesSchema.parse(response.body)
    const [game] = parsed.games
    if (!game) throw new Error('The API lists no Game to make Squads for')
    return { id: game.id, platform: game.platforms[0] ?? null }
  }

  private note(response: { mitigated: boolean }): void {
    if (response.mitigated) this.mitigated += 1
  }

  /** The host makes the Squad, the second player joins it, and both subscribe to it over their sockets. */
  private async makeSquad(
    game: { id: string; platform: string | null },
    [index, host, joiner]: [number, Player, Player | undefined]
  ): Promise<void> {
    const fills = index % 2 === 0
    const created = await this.api.request('POST', '/api/rooms', {
      player: host,
      body: {
        name: `${this.options.tag}-${index}`,
        gameId: game.id,
        maxPlayers: fills ? FILLING_SQUAD_SIZE : OPEN_SQUAD_SIZE,
        discordLink: this.options.discordInvite,
        tags: ['loadtest'],
        platform: game.platform,
      },
    })
    this.create.record(created.status, created.milliseconds)
    this.note(created)
    const code = createdSchema.safeParse(created.body)
    if (!code.success) return
    this.squadsCreated += 1
    const roomCode = code.data.room.code
    this.fleet.send(host, { type: 'join_room', payload: { roomCode } })
    if (!joiner) return
    const joined = await this.api.request('POST', `/api/rooms/${roomCode}/join`, { player: joiner })
    this.join.record(joined.status, joined.milliseconds)
    this.note(joined)
    if (joined.status !== 200) return
    if (fills) this.squadsReady += 1
    this.fleet.send(joiner, { type: 'join_room', payload: { roomCode } })
  }

  /** Reads the Squad Board at the set rate, open loop: a slow answer does not slow the next request. */
  private async readBoard(): Promise<void> {
    const pending = new Set<Promise<void>>()
    const deadline = performance.now() + this.options.durationSeconds * 1000
    let owed = 0
    let last = performance.now()
    let reader = 0
    while (performance.now() < deadline && !this.stopped() && this.abortedFor === null) {
      const now = performance.now()
      owed += ((now - last) * this.options.rps) / 1000
      last = now
      while (owed >= 1) {
        owed -= 1
        const player = this.players[reader++ % this.players.length]
        const request = this.api.request('GET', '/api/rooms', { player }).then((response) => {
          this.board.record(response.status, response.milliseconds)
          this.note(response)
        })
        pending.add(request)
        void request.finally(() => pending.delete(request))
      }
      this.minOpen = Math.min(this.minOpen, this.fleet.openNow)
      if (this.board.count >= 100 && this.board.errorRate > this.options.abortErrorRate) {
        this.abortedFor = `board error rate above ${this.options.abortErrorRate}`
      }
      await sleep(TICK_MS)
    }
    await Promise.allSettled([...pending])
  }

  private report(): RunReport {
    return {
      players: this.players.length,
      sockets: this.fleet.summary(),
      setup: { create: this.create.summary(), join: this.join.summary() },
      board: this.board.summary(),
      minOpenDuringBoard: Number.isFinite(this.minOpen) ? this.minOpen : this.fleet.openNow,
      squadsCreated: this.squadsCreated,
      squadsReady: this.squadsReady,
      mitigated: this.mitigated,
      abortedFor: this.abortedFor,
    }
  }
}
