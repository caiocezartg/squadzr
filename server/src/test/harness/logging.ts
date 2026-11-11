import type { FastifyLoggerOptions } from 'fastify'
import { requestLogSerializers } from '@/app'

export interface LogCapture {
  /** Raw JSON log lines, in emission order. */
  readonly lines: string[]
  readonly logger: FastifyLoggerOptions
}

/**
 * In-memory info-level logger that keeps Fastify's request logs and our own, with
 * the production request serializer.
 */
export function createLogCapture(level = 'info'): LogCapture {
  const lines: string[] = []
  return {
    lines,
    logger: {
      level,
      stream: { write: (line: string) => void lines.push(line) },
      serializers: requestLogSerializers,
    },
  }
}
