import type { SignalRecord } from '../../shared/types'
import { computeMetrics } from '../../shared/metrics'

export function computeRollingMetrics(history: SignalRecord[]) {
  return computeMetrics(history)
}
