import { z } from 'zod'
import type { SignalRecord } from '../../shared/types'

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).default(7),
  symbol: z.string().default('ASELS')
})

interface KVNamespaceLike {
  list(options?: { prefix?: string }): Promise<{ keys: { name: string }[] }>
  get<T = unknown>(key: string, options?: 'json'): Promise<T | null>
}

export default defineEventHandler(async (event) => {
  const query = querySchema.parse(getQuery(event))
  const env = event.context.cloudflare?.env as { SIGNAL_KV?: KVNamespaceLike } | undefined
  const records = env?.SIGNAL_KV ? await readHistoryFromKv(env.SIGNAL_KV, query.symbol, query.days) : []

  return {
    symbol: query.symbol,
    days: query.days,
    storage_ready: Boolean(env?.SIGNAL_KV),
    records: records.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
  }
})

async function readHistoryFromKv(kv: KVNamespaceLike, symbol: string, days: number): Promise<SignalRecord[]> {
  const since = Date.now() - days * 24 * 60 * 60 * 1000
  const signalKeys = await kv.list({ prefix: `signal:${symbol}:` })
  const records = await Promise.all(signalKeys.keys.map(async ({ name }) => {
    const record = await kv.get<SignalRecord>(name, 'json')
    if (!record || Date.parse(record.timestamp) < since) return null
    const result = await kv.get<Partial<SignalRecord['results']>>(`result:${symbol}:${record.timestamp}`, 'json')
    return { ...record, results: result ?? record.results ?? {} }
  }))

  const filtered = records.filter((record): record is SignalRecord => Boolean(record))
  return filtered
}
