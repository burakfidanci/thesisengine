import type { Env } from '../scheduled'
import type { Horizon, SignalRecord } from '../../shared/types'
import { directionFromReturn } from '../../shared/thresholds'

const horizonMinutes: Record<Horizon, number> = {
  '15m': 15,
  '1h': 60,
  eod: 24 * 60
}

export async function resolveResults(signal: SignalRecord, env: Env) {
  if (signal.price === null) return withWarning(signal, 'Cannot resolve outcomes because start price is unavailable.')

  const now = Date.now()
  const price = await fetchLatestPrice(env.SYMBOL_YAHOO ?? `${signal.symbol}.IS`).catch(() => null)
  if (price === null) return withWarning(signal, 'Cannot resolve outcomes because current actual price is unavailable.')

  const timestamp = Date.parse(signal.timestamp)
  const nextResults = { ...signal.results }

  for (const horizon of Object.keys(horizonMinutes) as Horizon[]) {
    if (nextResults[horizon]) continue
    const targetTime = timestamp + horizonMinutes[horizon] * 60 * 1000
    if (now < targetTime) continue
    const returnPct = (price - signal.price) / signal.price
    const actualDirection = directionFromReturn(returnPct, horizon)
    nextResults[horizon] = {
      target_timestamp: new Date(targetTime).toISOString(),
      start_price: signal.price,
      end_price: price,
      return_pct: Number(returnPct.toFixed(6)),
      actual_direction: actualDirection,
      prediction_correct: signal.predictions[horizon].direction === actualDirection
    }
  }

  return { ...signal, results: nextResults }
}

async function fetchLatestPrice(symbol: string) {
  const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=5m&range=1d`)
  if (!response.ok) return null
  const payload = await response.json() as {
    chart?: {
      result?: Array<{ indicators?: { quote?: Array<{ close?: Array<number | null> }> } }>
    }
  }
  const closes = payload.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
  const latest = closes.filter((value): value is number => Number.isFinite(value)).at(-1)
  return latest ?? null
}

function withWarning(signal: SignalRecord, warning: string) {
  return {
    ...signal,
    warnings: Array.from(new Set([...signal.warnings, warning]))
  }
}
