export async function collectSnapshot(symbol: string) {
  return {
    symbol,
    collected_at: new Date().toISOString(),
    provider: 'configured',
    delayed: true
  }
}
