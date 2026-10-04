/** Local execution order for subscriptions, committed changes and socket messages. */
export class OrderedOperations {
  private pending: Promise<unknown> = Promise.resolve()

  run<T>(operation: () => T | Promise<T>): Promise<T> {
    const result = this.pending.then(operation)
    this.pending = result.catch(() => undefined)
    return result
  }

  async drain(): Promise<void> {
    await this.pending
  }
}
