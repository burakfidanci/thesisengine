import { collectSnapshot } from './jobs/collectSnapshot'
import { generateSignal } from './jobs/generateSignal'
import { resolveResults } from './jobs/resolveResults'
import { readSignals, saveEvidence, saveSignal, type SignalKv } from './storage/kvStorage'

export interface Env {
  SIGNAL_KV: SignalKv
  SYMBOL?: string
  SYMBOL_YAHOO?: string
  OPENAI_API_KEY?: string
  OPENAI_MODEL?: string
  GOOGLE_NEWS_RSS_URL?: string
  DATA_DELAY_MINUTES?: string
  XU100_SYMBOL?: string
  ORDER_FLOW_ENABLED?: string
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runScheduled(env))
  }
}

async function runScheduled(env: Env) {
  const symbol = env.SYMBOL ?? 'ASELS'
  await collectSnapshot(symbol)
  const history = await readSignals(env.SIGNAL_KV, symbol)
  await Promise.all(history.map(async (record) => saveSignal(env.SIGNAL_KV, await resolveResults(record, env))))
  const generated = await generateSignal(symbol, env)
  await saveSignal(env.SIGNAL_KV, generated.signal)
  await saveEvidence(env.SIGNAL_KV, symbol, generated.evidence)
}
