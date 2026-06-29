export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const symbol = String(query.symbol ?? 'ASELS')
  const env = event.context.cloudflare?.env as { SIGNAL_KV?: { list(options?: { prefix?: string }): Promise<{ keys: { name: string }[] }>, get<T = unknown>(key: string, options?: 'json'): Promise<T | null> } } | undefined

  if (env?.SIGNAL_KV) {
    const keys = await env.SIGNAL_KV.list({ prefix: `signal:${symbol}:` })
    const latestKey = keys.keys.map((key) => key.name).sort().at(-1)
    if (latestKey) {
      const latest = await env.SIGNAL_KV.get(latestKey, 'json')
      if (latest) return latest
    }
  }

  return null
})
