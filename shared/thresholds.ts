import type { Direction, Horizon } from './types'

export const directionThresholds: Record<Horizon, number> = {
  '15m': 0.001,
  '1h': 0.002,
  eod: 0.005
}

export function directionFromReturn(returnPct: number, horizon: Horizon): Direction {
  const threshold = directionThresholds[horizon]
  if (returnPct >= threshold) return 'UP'
  if (returnPct <= -threshold) return 'DOWN'
  return 'NEUTRAL'
}

export function directionFromScore(score: number): Direction {
  if (score >= 62) return 'UP'
  if (score <= 38) return 'DOWN'
  return 'NEUTRAL'
}
