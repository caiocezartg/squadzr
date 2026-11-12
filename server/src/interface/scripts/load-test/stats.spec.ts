import { describe, expect, it } from 'vitest'
import { RequestRecorder, percentile } from './stats'

describe('percentile', () => {
  const sorted = Array.from({ length: 100 }, (_, index) => index + 1)

  it('uses the nearest rank', () => {
    expect(percentile(sorted, 50)).toBe(50)
    expect(percentile(sorted, 95)).toBe(95)
    expect(percentile(sorted, 100)).toBe(100)
    expect(percentile([7], 95)).toBe(7)
  })

  it('is zero for no samples', () => {
    expect(percentile([], 50)).toBe(0)
  })
})

describe('RequestRecorder', () => {
  it('counts every status that is not 2xx, and an unanswered request, as an error', () => {
    const recorder = new RequestRecorder()
    recorder.record(200, 10)
    recorder.record(200, 30)
    recorder.record(429, 5)
    recorder.record(0, 15_000)

    expect(recorder.summary()).toMatchObject({
      requests: 4,
      errors: 2,
      errorRate: 0.5,
      statuses: { '200': 2, '429': 1, '0': 1 },
    })
  })

  it('reports the latency percentiles over every request', () => {
    const recorder = new RequestRecorder()
    for (let ms = 1; ms <= 100; ms += 1) recorder.record(200, ms)

    expect(recorder.summary()).toMatchObject({ p50: 50, p95: 95, p99: 99, errorRate: 0 })
  })

  it('has an error rate of zero before any request', () => {
    expect(new RequestRecorder().errorRate).toBe(0)
  })
})
