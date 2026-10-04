/** Independent execution order per socket or room; settled scopes retain no state. */
export class OrderedOperations {
  private readonly pending = new Map<
    object | string | symbol,
    Map<string | symbol, Promise<void>>
  >()
  private readonly defaultScope = Symbol('maintenance')

  run<T>(
    operation: () => T | Promise<T>,
    scope: object | string | symbol = this.defaultScope,
    channel: string | symbol = this.defaultScope
  ): Promise<T> {
    let channels = this.pending.get(scope)
    if (!channels) {
      channels = new Map()
      this.pending.set(scope, channels)
    }
    const result = (channels.get(channel) ?? Promise.resolve()).then(operation)
    const tail = result.then(
      () => undefined,
      () => undefined
    )
    channels.set(channel, tail)
    void tail.then(() => {
      if (channels.get(channel) === tail) channels.delete(channel)
      if (channels.size === 0) this.pending.delete(scope)
    })
    return result
  }

  async drain(): Promise<void> {
    // Finishing one scope can enqueue delivery or Presence work in another.
    while (this.pending.size > 0)
      await Promise.all([...this.pending.values()].flatMap((channels) => [...channels.values()]))
  }
}
