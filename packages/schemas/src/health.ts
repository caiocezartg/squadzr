import { z } from 'zod'

// Health probe answer shared by /health and /health/ready, whether the probe passes or fails.
export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  timestamp: z.string(),
  uptime: z.number(),
  version: z.string(),
})

export type HealthResponse = z.infer<typeof healthResponseSchema>
