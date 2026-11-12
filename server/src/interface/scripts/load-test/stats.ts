/** The value at percentile `p` (0 to 100) of an ascending list, by the nearest-rank method. */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0
  const rank = Math.ceil((p / 100) * sorted.length)
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1] ?? 0
}

export interface RequestSummary {
  readonly requests: number
  readonly errors: number
  readonly errorRate: number
  readonly p50: number
  readonly p95: number
  readonly p99: number
  readonly statuses: Readonly<Record<string, number>>
}

/** Collects the outcome of HTTP requests. Status 0 is a request that never got an answer. */
export class RequestRecorder {
  private readonly latencies: number[] = []
  private readonly statuses = new Map<string, number>()
  private failures = 0

  record(status: number, milliseconds: number): void {
    this.latencies.push(milliseconds)
    this.statuses.set(String(status), (this.statuses.get(String(status)) ?? 0) + 1)
    if (status < 200 || status >= 300) this.failures += 1
  }

  get count(): number {
    return this.latencies.length
  }

  get errorRate(): number {
    return this.latencies.length === 0 ? 0 : this.failures / this.latencies.length
  }

  summary(): RequestSummary {
    const sorted = [...this.latencies].sort((a, b) => a - b)
    return {
      requests: sorted.length,
      errors: this.failures,
      errorRate: this.errorRate,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      statuses: Object.fromEntries(this.statuses),
    }
  }
}
