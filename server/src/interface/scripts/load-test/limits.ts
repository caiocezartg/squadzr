import { randomBytes } from 'node:crypto'
import http from 'node:http'
import https from 'node:https'
import type { LimitsOptions } from './options'

const WAIT_MS = 10_000
const BATCH = 25

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export interface LimitsReport {
  readonly family: number
  /** The statuses of the requests inside the limit (as counts) and of the first one past it. */
  readonly requests: {
    readonly allowed: Readonly<Record<string, number>>
    readonly pastLimit: number
    readonly retryAfter: string | null
  }
  /** What the socket past the concurrent limit got: the close code, or null when it stayed open. */
  readonly extraSocket: {
    readonly index: number
    readonly closeCode: number | null
    readonly reason: string
  }
  /** Which upgrade of the minute was the first one refused, and with what HTTP status. */
  readonly upgrades: { readonly refusedAt: number | null; readonly status: number | null }
}

/** One address family for every connection, so "one client address" is one address even on a dual-stack host. */
class Wire {
  private readonly url: URL
  private readonly agent: http.Agent
  constructor(
    target: string,
    private readonly origin: string,
    private readonly family: 4 | 6
  ) {
    this.url = new URL(target)
    const Agent = this.url.protocol === 'https:' ? https.Agent : http.Agent
    this.agent = new Agent({ keepAlive: true, maxSockets: BATCH })
  }

  private get client() {
    return this.url.protocol === 'https:' ? https : http
  }

  get(path: string): Promise<{ status: number; retryAfter: string | null }> {
    return new Promise((resolve) => {
      const request = this.client.request(
        {
          host: this.url.hostname,
          port: this.url.port || undefined,
          path,
          family: this.family,
          agent: this.agent,
          headers: { origin: this.origin },
        },
        (response) => {
          response.resume()
          const retry = response.headers['retry-after']
          resolve({ status: response.statusCode ?? 0, retryAfter: retry ? String(retry) : null })
        }
      )
      request.on('error', () => resolve({ status: 0, retryAfter: null }))
      request.setTimeout(WAIT_MS, () => request.destroy())
      request.end()
    })
  }

  /** One upgrade request: 101 when the server switched protocols (the socket is dropped at once), else its HTTP status. */
  upgrade(): Promise<number> {
    return new Promise((resolve) => {
      const request = this.client.request({
        host: this.url.hostname,
        port: this.url.port || undefined,
        path: '/ws',
        family: this.family,
        agent: false,
        headers: {
          connection: 'Upgrade',
          upgrade: 'websocket',
          'sec-websocket-version': '13',
          'sec-websocket-key': randomBytes(16).toString('base64'),
          origin: this.origin,
        },
      })
      request.on('upgrade', (_response, socket) => {
        socket.destroy()
        resolve(101)
      })
      request.on('response', (response) => {
        response.resume()
        resolve(response.statusCode ?? 0)
      })
      request.on('error', () => resolve(0))
      request.end()
    })
  }

  close(): void {
    this.agent.destroy()
  }
}

/** The first `limit` requests as concurrent batches, then one more: the one past the limit. */
async function checkRequests(wire: Wire, limit: number): Promise<LimitsReport['requests']> {
  const allowed = new Map<string, number>()
  for (let sent = 0; sent < limit; sent += BATCH) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(BATCH, limit - sent) }, () => wire.get('/api/rooms'))
    )
    for (const { status } of batch)
      allowed.set(String(status), (allowed.get(String(status)) ?? 0) + 1)
  }
  const past = await wire.get('/api/rooms')
  return {
    allowed: Object.fromEntries(allowed),
    pastLimit: past.status,
    retryAfter: past.retryAfter,
  }
}

function openSocket(
  url: string,
  origin: string
): Promise<{ socket: WebSocket; closed: Promise<{ code: number; reason: string }> }> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { headers: { origin } } as unknown as string[])
    const closed = new Promise<{ code: number; reason: string }>((done) => {
      socket.onclose = (event) => done({ code: event.code, reason: event.reason })
    })
    const timer = setTimeout(() => reject(new Error('socket did not open')), WAIT_MS)
    socket.onopen = () => {
      clearTimeout(timer)
      resolve({ socket, closed })
    }
    socket.onerror = () => {
      clearTimeout(timer)
      reject(new Error('socket refused'))
    }
  })
}

/** Holds `limit` sockets one after another, opens one more and reports how the server answered it. */
async function checkSockets(
  url: string,
  origin: string,
  limit: number
): Promise<LimitsReport['extraSocket']> {
  const held: WebSocket[] = []
  try {
    for (let i = 0; i < limit; i += 1) held.push((await openSocket(url, origin)).socket)
    const over = await openSocket(url, origin)
    const closed = await Promise.race([over.closed, sleep(WAIT_MS).then(() => null)])
    over.socket.close()
    return { index: limit + 1, closeCode: closed?.code ?? null, reason: closed?.reason ?? '' }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'refused'
    return { index: held.length + 1, closeCode: null, reason }
  } finally {
    for (const socket of held) socket.close(1000, 'limits check over')
  }
}

/** Keeps upgrading until the server refuses one; `spent` upgrades of this minute are already used. */
async function checkUpgrades(wire: Wire, limit: number, spent: number) {
  for (let attempt = spent + 1; attempt <= limit + 5; attempt += 1) {
    const status = await wire.upgrade()
    if (status !== 101) return { refusedAt: attempt, status }
  }
  return { refusedAt: null, status: null }
}

export async function checkLimits(
  target: string,
  origin: string,
  options: LimitsOptions
): Promise<LimitsReport> {
  const wire = new Wire(target, origin, options.ipFamily)
  try {
    const requests = await checkRequests(wire, options.requestLimit)
    console.log(`Request limit checked; waiting ${options.cooldownSeconds}s for a fresh minute`)
    await sleep(options.cooldownSeconds * 1000)

    const extraSocket = await checkSockets(
      `${target.replace(/\/$/, '').replace(/^http/, 'ws')}/ws`,
      origin,
      options.socketLimit
    )
    // The held sockets and the one past them each spent an upgrade of this minute.
    const upgrades = await checkUpgrades(wire, options.upgradeLimit, options.socketLimit + 1)
    return { family: options.ipFamily, requests, extraSocket, upgrades }
  } finally {
    wire.close()
  }
}
