import type { AccuracyMetrics, Direction, Horizon, SignalRecord } from './types'
import { directionFromScore } from './thresholds'

const horizons: Horizon[] = ['15m', '1h', 'eod']
const directions: Direction[] = ['UP', 'DOWN', 'NEUTRAL']

export function computeMetrics(history: SignalRecord[]): AccuracyMetrics {
  const completed = history.filter((record) => horizons.some((horizon) => record.results[horizon]))
  const accuracy = Object.fromEntries(horizons.map((horizon) => {
    const rows = completed.filter((record) => record.results[horizon])
    return [horizon, ratio(rows.filter((record) => record.results[horizon]?.prediction_correct).length, rows.length)]
  })) as Record<Horizon, number>

  const directionAccuracy = Object.fromEntries(directions.map((direction) => {
    const pairs = completed.flatMap((record) => horizons.map((horizon) => ({
      prediction: record.predictions[horizon].direction,
      correct: record.results[horizon]?.prediction_correct
    }))).filter((row) => row.prediction === direction && row.correct !== undefined)
    return [direction, ratio(pairs.filter((row) => row.correct).length, pairs.length)]
  })) as Record<Direction, number>

  const resolvedPairs = completed.flatMap((record) => horizons.map((horizon) => ({
    confidence: record.predictions[horizon].confidence,
    correct: record.results[horizon]?.prediction_correct
  }))).filter((row) => row.correct !== undefined)
  const confidences = resolvedPairs.map((row) => row.confidence)
  const bucketEntries = ['50-60', '60-70', '70-80', '80+'].map((bucket) => {
    const pairs = resolvedPairs.filter((row) => {
      if (bucket === '50-60') return row.confidence >= 50 && row.confidence < 60
      if (bucket === '60-70') return row.confidence >= 60 && row.confidence < 70
      if (bucket === '70-80') return row.confidence >= 70 && row.confidence < 80
      return row.confidence >= 80
    })
    return [bucket, ratio(pairs.filter((row) => row.correct).length, pairs.length)]
  })

  const ablationRows = completed.filter((record) => record.results['15m'])
  const ablationAccuracy = {
    'Sadece haber': ratio(ablationRows.filter((record) => directionFromScore(record.ablation.news_only_score) === record.results['15m']?.actual_direction).length, ablationRows.length),
    'Haber + teknik': ratio(ablationRows.filter((record) => directionFromScore((record.ablation.news_only_score + record.ablation.technical_only_score) / 2) === record.results['15m']?.actual_direction).length, ablationRows.length),
    'Haber + teknik + order-flow': accuracy['15m']
  }

  const layerScores = {
    KAP: average(completed.map((record) => record.scores.kap_score)),
    Haber: average(completed.map((record) => record.scores.news_score)),
    Teknik: average(completed.map((record) => record.scores.technical_score)),
    'Market Context': average(completed.map((record) => record.scores.market_context_score)),
    'Order Flow': average(completed.map((record) => record.scores.order_flow_score ?? 50))
  }
  const sortedLayers = Object.entries(layerScores).sort((a, b) => b[1] - a[1])

  return {
    total: completed.length,
    accuracy,
    directionAccuracy,
    averageConfidence: Math.round(average(confidences)),
    confidenceBuckets: Object.fromEntries(bucketEntries),
    brierLikeScore: Number((1 - average(Object.values(accuracy))).toFixed(3)),
    averageDirectionAlignment: Number(average(horizons.map((horizon) => accuracy[horizon])).toFixed(3)),
    bestLayer: sortedLayers[0]?.[0] ?? 'N/A',
    weakestLayer: sortedLayers.at(-1)?.[0] ?? 'N/A',
    ablationAccuracy
  }
}

function ratio(correct: number, total: number) {
  return total === 0 ? 0 : Number((correct / total).toFixed(3))
}

function average(values: number[]) {
  const safeValues = values.filter(Number.isFinite)
  return safeValues.length ? safeValues.reduce((sum, value) => sum + value, 0) / safeValues.length : 0
}
