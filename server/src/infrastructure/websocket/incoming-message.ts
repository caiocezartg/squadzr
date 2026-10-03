import { describeContractIssues, type ContractIssue } from '@squadzr/schemas'
import { wsIncomingMessageSchema, type WsIncomingMessage } from './types'

export type IncomingMessageResult =
  | { ok: true; message: WsIncomingMessage }
  | {
      ok: false
      code: 'PARSE_ERROR' | 'INVALID_MESSAGE'
      /** Reply sent to the client. */
      reason: string
      /** Safe to log: issue paths and codes only, never the frame or the parser message. */
      issues: ContractIssue[]
    }

/**
 * Reads a client frame against the incoming message contract. The frame and
 * the JSON parser error, whose message quotes the input, never leave this
 * function: a rejection carries only a code and the location of each issue.
 */
export function parseIncomingMessage(
  rawData: Buffer | ArrayBuffer | Buffer[]
): IncomingMessageResult {
  let data: unknown
  try {
    data = JSON.parse(rawData.toString())
  } catch {
    return {
      ok: false,
      code: 'PARSE_ERROR',
      reason: 'Failed to parse message',
      issues: [{ path: '', code: 'invalid_json' }],
    }
  }

  const result = wsIncomingMessageSchema.safeParse(data)
  if (!result.success) {
    return {
      ok: false,
      code: 'INVALID_MESSAGE',
      reason: 'Invalid message format',
      issues: describeContractIssues(result.error),
    }
  }
  return { ok: true, message: result.data }
}
