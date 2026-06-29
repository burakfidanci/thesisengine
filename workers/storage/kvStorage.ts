import type { EvidenceItem, SignalRecord } from '../../shared/types'

export interface SignalKv {
  put(key: string, value: string): Promise<void>
  list(options?: { prefix?: string }): Promise<{ keys: { name: string }[] }>
  get<T = unknown>(key: string, options?: 'json'): Promise<T | null>
}

export async function saveSignal(kv: SignalKv, signal: SignalRecord) {
  await kv.put(`signal:${signal.symbol}:${signal.timestamp}`, JSON.stringify(signal))
  await kv.put(`result:${signal.symbol}:${signal.timestamp}`, JSON.stringify(signal.results))
}

export async function saveEvidence(kv: SignalKv, symbol: string, items: EvidenceItem[]) {
  await Promise.all(items.map((item) => kv.put(`evidence:${symbol}:${item.timestamp}:${item.id}`, JSON.stringify(item))))
}

export async function readSignals(kv: SignalKv, symbol: string) {
  const keys = await kv.list({ prefix: `signal:${symbol}:` })
  const records = await Promise.all(keys.keys.map(async ({ name }) => kv.get<SignalRecord>(name, 'json')))
  return records
    .filter((record): record is SignalRecord => Boolean(record))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
}
