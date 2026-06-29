export default defineEventHandler((event) => {
  const env = event.context.cloudflare?.env as {
    SIGNAL_KV?: unknown
    OPENAI_API_KEY?: string
    GOOGLE_NEWS_RSS_URL?: string
    ORDER_FLOW_ENABLED?: string
    SYMBOL_YAHOO?: string
    XU100_SYMBOL?: string
  } | undefined

  const providers = {
    kv: env?.SIGNAL_KV ? 'configured' : 'unavailable',
    price_volume: env?.SYMBOL_YAHOO ? 'delayed public chart source configured' : 'unavailable',
    technical: env?.SYMBOL_YAHOO ? 'derived from delayed price/volume' : 'insufficient',
    market_context: env?.XU100_SYMBOL ? 'delayed public chart source configured' : 'unavailable',
    news: env?.GOOGLE_NEWS_RSS_URL ? 'rss configured' : 'unavailable',
    kap: 'unavailable',
    order_flow: env?.ORDER_FLOW_ENABLED === 'true' ? 'configured' : 'unavailable',
    openai_classifier: env?.OPENAI_API_KEY ? 'configured' : 'unavailable'
  }

  const warnings = [
    providers.kap === 'unavailable' ? 'KAP ingestion is not connected; KAP is not counted as real evidence.' : '',
    providers.order_flow === 'unavailable' ? 'Order-flow is unavailable; configured active weights redistribute its share.' : '',
    providers.openai_classifier === 'unavailable' ? 'OpenAI classifier is unavailable; text classification uses fallback labels only.' : '',
    providers.kv === 'unavailable' ? 'SIGNAL_KV binding is missing; dashboard history will be empty.' : ''
  ].filter(Boolean)

  return {
    status: providers.kv === 'configured' ? 'ok' : 'degraded',
    kv: providers.kv,
    providers,
    warnings
  }
})
