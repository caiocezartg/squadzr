import { describe, expect, it } from 'vitest'
import { OrderedOperations } from './ordered-operations'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('scoped ordered operations', () => {
  it('serializes one scope while other sockets and room channels keep running', async () => {
    const operations = new OrderedOperations()
    const socket = {}
    const gate = deferred()
    const received: string[] = []
    const first = operations.run(() => gate.promise, socket)
    const second = operations.run(() => received.push('same socket'), socket)
    await operations.run(() => received.push('other socket'), {})
    await operations.run(() => received.push('other room'), socket, 'OTHER1')
    expect(received).toEqual(['other socket', 'other room'])
    gate.resolve()
    await Promise.all([first, second])
    expect(received).toEqual(['other socket', 'other room', 'same socket'])
    await operations.drain()
    expect(operations['pending'].size).toBe(0)
  })

  it('continues a scope after failure and drains work enqueued by another scope', async () => {
    const operations = new OrderedOperations()
    const failed = operations.run(() => {
      throw new Error('query failed')
    }, 'ROOM01')
    await expect(failed).rejects.toThrow('query failed')
    const gate = deferred()
    let delivered = false
    void operations.run(() => {
      void operations.run(async () => {
        await gate.promise
        delivered = true
      }, {})
    }, 'ROOM01')
    let drained = false
    const drain = operations.drain().then(() => {
      drained = true
    })
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(drained).toBe(false)
    gate.resolve()
    await drain
    expect(delivered).toBe(true)
    expect(operations['pending'].size).toBe(0)
  })
})
