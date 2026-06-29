export type Horizon = '15m' | '1h' | 'eod'
export type Direction = 'UP' | 'DOWN' | 'NEUTRAL'
export type DataQuality = 'real' | 'mock' | 'delayed' | 'unavailable' | 'insufficient'

export interface Prediction {
  direction: Direction
  confidence: number
  threshold: number
}

export interface SignalResult {
  target_timestamp: string
  start_price: number | null
  end_price: number | null
  return_pct: number
  actual_direction: Direction
  prediction_correct: boolean
}

export interface SignalRecord {
  symbol: string
  timestamp: string
  price: number | null
  data_delay_minutes: number
  data_quality: DataQuality
  warnings: string[]
  layer_status: {
    kap: DataQuality
    news: DataQuality
    price_volume: DataQuality
    technical: DataQuality
    market_context: DataQuality
    order_flow: DataQuality
    anomaly: DataQuality
  }
  predictions: Record<Horizon, Prediction>
  scores: {
    kap_score: number
    news_score: number
    technical_score: number
    market_context_score: number
    order_flow_score: number | null
    anomaly_score: number
    final_score: number
  }
  ablation: {
    news_only_score: number
    kap_news_score: number
    technical_only_score: number
    technical_plus_market_score: number
    full_model_score: number
  }
  explanation: {
    summary: string
    positive_factors: string[]
    negative_factors: string[]
    uncertainties: string[]
  }
  raw_items: {
    kap_count: number
    news_count: number
    price_volume_points: number
    order_book_available: boolean
  }
  model_config: {
    symbol: string
    horizons: Horizon[]
    score_weights: Record<string, number>
    order_flow_available: boolean
    base_score_weights: Record<string, number>
    direction_thresholds: {
      up: number
      down: number
    }
    result_thresholds: Record<Horizon, number>
    redistribution_note: string
    openai_role: string
  }
  results: Partial<Record<Horizon, SignalResult>>
}

export interface EvidenceItem {
  id: string
  timestamp: string
  source: 'KAP' | 'News'
  title: string
  event_type: string
  sentiment: 'positive' | 'neutral' | 'negative'
  relevance: number
  impact: number
  novelty: number
  reason: string
}

export interface AccuracyMetrics {
  total: number
  accuracy: Record<Horizon, number>
  directionAccuracy: Record<Direction, number>
  averageConfidence: number
  confidenceBuckets: Record<string, number>
  brierLikeScore: number
  averageDirectionAlignment: number
  bestLayer: string
  weakestLayer: string
  ablationAccuracy: Record<string, number>
}
