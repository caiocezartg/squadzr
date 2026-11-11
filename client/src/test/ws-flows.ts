/**
 * Act-wrapped helpers so WebSocket events driven by tests keep React's state
 * updates inside act(), mirroring how the server would push events to the UI.
 */

import { act } from '@testing-library/react'
import { latestWebSocket } from './ws-mock'
import type { MockServerMessage } from './ws-mock'

export function openLatestWebSocket(): void {
  act(() => {
    latestWebSocket().open()
  })
}

export function sendFromServer(message: MockServerMessage): void {
  act(() => {
    latestWebSocket().serverSend(message)
  })
}

export function serverSentFrames(): Array<{ type: string; payload: unknown }> {
  return latestWebSocket().sentFrames()
}
