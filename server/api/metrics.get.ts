import { z } from 'zod'
import type { SignalRecord } from '../../shared/types'
import { computeMetrics } from '../../shared/metrics'

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).default(7),
  symbol: z.string().default('ASELS')
})

export default defineEventHandler(async (event) => {
  const query = querySchema.parse(getQuery(event))
  const historyResponse = await $fetch<{ records: SignalRecord[] }>('/api/history', {
    query
  })

  return computeMetrics(historyResponse.records)
})
