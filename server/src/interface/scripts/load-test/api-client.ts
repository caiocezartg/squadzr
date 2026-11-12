import type { Player } from './data-commands'

const REQUEST_TIMEOUT_MS = 15_000

export interface ApiResponse {
  /** 0 when the request got no answer (network error or timeout). */
  readonly status: number
  readonly milliseconds: number
  readonly body: unknown
  /** Cloudflare answered with a challenge or block instead of the API. */
  readonly mitigated: boolean
}

/** The API over HTTP and WebSocket, as the app's own browser would reach it. */
export class ApiClient {
  constructor(
    readonly target: string,
    private readonly origin: string
  ) {}

  get webSocketUrl(): string {
    return `${this.target.replace(/\/$/, '').replace(/^http/, 'ws')}/ws`
  }

  headers(player?: Player): Record<string, string> {
    return {
      origin: this.origin,
      'content-type': 'application/json',
      ...(player ? { cookie: player.cookie } : {}),
    }
  }

  async request(
    method: string,
    path: string,
    options: { player?: Player; body?: unknown } = {}
  ): Promise<ApiResponse> {
    const started = performance.now()
    try {
      const response = await fetch(`${this.target.replace(/\/$/, '')}${path}`, {
        method,
        headers: this.headers(options.player),
        body: requestBody(method, options.body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      const text = await response.text()
      return {
        status: response.status,
        milliseconds: performance.now() - started,
        body: parseJson(text),
        mitigated: response.headers.has('cf-mitigated'),
      }
    } catch {
      return { status: 0, milliseconds: performance.now() - started, body: null, mitigated: false }
    }
  }
}

/** A POST without a payload still carries `{}`: the API refuses an empty body under a JSON content type. */
function requestBody(method: string, body: unknown): string | undefined {
  if (body !== undefined) return JSON.stringify(body)
  return method === 'GET' ? undefined : '{}'
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
