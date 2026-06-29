import { z } from 'zod'
import type { EvidenceItem } from '../../shared/types'

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).default(7),
  symbol: z.string().default('ASELS')
})

export default defineEventHandler(async (event) => {
  const query = querySchema.parse(getQuery(event))
  const env = event.context.cloudflare?.env as { SIGNAL_KV?: { list(options?: { prefix?: string }): Promise<{ keys: { name: string }[] }>, get<T = unknown>(key: string, options?: 'json'): Promise<T | null> } } | undefined
  if (!env?.SIGNAL_KV) return []

  const since = Date.now() - query.days * 24 * 60 * 60 * 1000
  const keys = await env.SIGNAL_KV.list({ prefix: `evidence:${query.symbol}:` })
  const items = await Promise.all(keys.keys.map(async ({ name }) => {
    const item = await env.SIGNAL_KV!.get<EvidenceItem>(name, 'json')
    if (!item || Date.parse(item.timestamp) < since) return null
    return item
  }))

  return items.filter((item): item is EvidenceItem => Boolean(item)).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
})
