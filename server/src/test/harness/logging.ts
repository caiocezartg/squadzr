import type { FastifyLoggerOptions, FastifyRequest } from 'fastify'

/**
 * Request serializer for log-capture test servers. `injectWS` dispatches the
 * WebSocket upgrade through Fastify's router with a socket-less raw request;
 * Fastify's default serializer (and the production `serializeRequestUrl`, via
 * `req.ip`) throws on it, which aborts the upgrade inside @fastify/websocket's
 * `onUpgrade` catch. Real `listen()` connections always carry a socket, so this
 * tolerant variant exists only for the in-memory test transport.
 */
export function tolerantRequestSerializer(req: FastifyRequest): Record<string, unknown> {
  return {
    method: req.method,
    url: req.url,
    remoteAddress: req.socket ? req.ip : undefined,
  }
}

export interface LogCapture {
  /** Raw JSON log lines, in emission order. */
  readonly lines: string[]
  readonly logger: FastifyLoggerOptions
}

/** In-memory info-level logger that keeps Fastify's request logs and our own. */
export function createLogCapture(level = 'info'): LogCapture {
  const lines: string[] = []
  return {
    lines,
    logger: {
      level,
      stream: { write: (line: string) => void lines.push(line) },
      serializers: { req: tolerantRequestSerializer },
    },
  }
}
