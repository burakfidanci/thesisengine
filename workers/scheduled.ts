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
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url)
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/api/health')) {
      return Response.json(workerHealth(env))
    }

    return Response.json({
      status: 'not_found',
      message: 'This is the scheduled SignalLab Worker. Dashboard routes are served by the Cloudflare Pages deployment.'
    }, { status: 404 })
  },

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

function workerHealth(env: Env) {
  const providers = {
    kv: env.SIGNAL_KV ? 'configured' : 'unavailable',
    price_volume: env.SYMBOL_YAHOO ? 'delayed public chart source configured' : 'unavailable',
    technical: env.SYMBOL_YAHOO ? 'derived from delayed price/volume' : 'insufficient',
    market_context: env.XU100_SYMBOL ? 'delayed public chart source configured' : 'unavailable',
    news: env.GOOGLE_NEWS_RSS_URL ? 'rss configured' : 'unavailable',
    kap: 'unavailable',
    order_flow: env.ORDER_FLOW_ENABLED === 'true' ? 'configured' : 'unavailable',
    openai_classifier: env.OPENAI_API_KEY ? 'configured' : 'unavailable'
  }

  return {
    service: 'thesisengine-scheduler',
    status: providers.kv === 'configured' ? 'ok' : 'degraded',
    kv: providers.kv,
    providers,
    warnings: [
      'This Worker handles scheduled signal generation. The Nuxt dashboard and history APIs are served by Cloudflare Pages.',
      providers.kap === 'unavailable' ? 'KAP ingestion is not connected; KAP is not counted as real evidence.' : '',
      providers.order_flow === 'unavailable' ? 'Order-flow is unavailable; configured active weights redistribute its share.' : '',
      providers.openai_classifier === 'unavailable' ? 'OpenAI classifier is unavailable; text classification uses fallback labels only.' : ''
    ].filter(Boolean)
  }
}
