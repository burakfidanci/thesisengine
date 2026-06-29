import type { Env } from '../scheduled'
import type { DataQuality, Direction, EvidenceItem, Horizon, SignalRecord } from '../../shared/types'
import { directionFromScore, directionThresholds } from '../../shared/thresholds'

const horizons: Horizon[] = ['15m', '1h', 'eod']

interface MarketPoint {
  timestamp: string
  close: number
  volume: number
}

export interface GeneratedSignal {
  signal: SignalRecord
  evidence: EvidenceItem[]
}

export async function generateSignal(symbol: string, env: Env): Promise<GeneratedSignal> {
  const warnings: string[] = []
  const yahooSymbol = env.SYMBOL_YAHOO ?? `${symbol}.IS`
  const [stockPoints, marketPoints, newsItems] = await Promise.all([
    fetchYahooChart(yahooSymbol, '5m', '1d').catch(() => {
      warnings.push(`Price/volume provider unavailable for ${yahooSymbol}.`)
      return []
    }),
    fetchYahooChart(env.XU100_SYMBOL ?? 'XU100.IS', '15m', '5d').catch(() => {
      warnings.push('Market context provider unavailable.')
      return []
    }),
    fetchNewsEvidence(symbol, env).catch(() => {
      warnings.push('News provider unavailable.')
      return []
    })
  ])

  const latestPoint = stockPoints.at(-1)
  const price = latestPoint?.close ?? null
  if (!latestPoint) warnings.push('No current market price is available; signal is marked insufficient.')

  const technicalScore = scoreMomentum(stockPoints)
  const marketScore = scoreMomentum(marketPoints)
  const newsScore = scoreNews(newsItems)
  const kapScore = 50
  const orderFlowScore = null
  const anomalyScore = scoreAnomaly(stockPoints)
  if (!env.OPENAI_API_KEY) warnings.push('OpenAI classifier unavailable; news/KAP text is not LLM-classified.')
  warnings.push('KAP disclosure ingestion is unavailable; KAP score is excluded as real evidence and held at baseline.')
  warnings.push('Order-flow/order-book provider is unavailable; order-flow is excluded as real evidence and weights are redistributed.')
  const layerStatus: SignalRecord['layer_status'] = {
    kap: 'unavailable',
    news: newsItems.length ? 'delayed' : 'unavailable',
    price_volume: latestPoint ? 'delayed' : 'unavailable',
    technical: stockPoints.length >= 3 ? 'delayed' : 'insufficient',
    market_context: marketPoints.length >= 3 ? 'delayed' : 'unavailable',
    order_flow: 'unavailable',
    anomaly: stockPoints.length >= 10 ? 'delayed' : 'insufficient'
  }
  const finalScore = weightedScore({
    kapScore,
    newsScore,
    technicalScore,
    marketScore,
    orderFlowScore,
    anomalyScore
  })
  const direction = directionFromScore(finalScore)
  const confidence = confidenceFromScore(finalScore, warnings.length)
  const dataQuality = overallQuality(layerStatus)

  const signal: SignalRecord = {
    symbol,
    timestamp: new Date().toISOString(),
    price,
    data_delay_minutes: Number(env.DATA_DELAY_MINUTES ?? 15),
    data_quality: dataQuality,
    warnings: Array.from(new Set(warnings)),
    layer_status: layerStatus,
    predictions: Object.fromEntries(horizons.map((horizon) => [horizon, {
      direction,
      confidence,
      threshold: directionThresholds[horizon]
    }])) as Record<Horizon, SignalRecord['predictions'][Horizon]>,
    scores: {
      kap_score: kapScore,
      news_score: newsScore,
      technical_score: technicalScore,
      market_context_score: marketScore,
      order_flow_score: orderFlowScore,
      anomaly_score: anomalyScore,
      final_score: finalScore
    },
    ablation: {
      news_only_score: newsScore,
      kap_news_score: roundScore((kapScore + newsScore) / 2),
      technical_only_score: technicalScore,
      technical_plus_market_score: roundScore((technicalScore + marketScore) / 2),
      full_model_score: finalScore
    },
    explanation: {
      summary: buildSummary(direction, finalScore, dataQuality),
      positive_factors: positiveFactors(newsScore, technicalScore, marketScore),
      negative_factors: negativeFactors(newsScore, technicalScore, marketScore),
      uncertainties: Array.from(new Set(warnings))
    },
    raw_items: {
      kap_count: 0,
      news_count: newsItems.length,
      price_volume_points: stockPoints.length,
      order_book_available: false
    },
    model_config: {
      symbol,
      horizons,
      score_weights: {
        kap_score: 0.22,
        news_score: 0.22,
        technical_score: 0.32,
        market_context_score: 0.19,
        anomaly_score: 0.05
      },
      order_flow_available: false,
      base_score_weights: {
        kap_score: 0.22,
        news_score: 0.18,
        technical_score: 0.22,
        market_context_score: 0.15,
        order_flow_score: 0.18,
        anomaly_score: 0.05
      },
      direction_thresholds: {
        up: 62,
        down: 38
      },
      result_thresholds: directionThresholds,
      redistribution_note: 'Order-flow unavailable: +0.10 technical, +0.04 market context, +0.04 news.',
      openai_role: 'Structured financial text classifier only; never a direct price oracle.'
    },
    results: {}
  }

  return { signal, evidence: newsItems }
}

async function fetchYahooChart(symbol: string, interval: string, range: string): Promise<MarketPoint[]> {
  const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`)
  if (!response.ok) return []
  const payload = await response.json() as {
    chart?: {
      result?: Array<{
        timestamp?: number[]
        indicators?: { quote?: Array<{ close?: Array<number | null>, volume?: Array<number | null> }> }
      }>
    }
  }
  const result = payload.chart?.result?.[0]
  const timestamps = result?.timestamp ?? []
  const quote = result?.indicators?.quote?.[0]
  return timestamps.map((timestamp, index) => {
    const close = quote?.close?.[index]
    if (!Number.isFinite(close)) return null
    return {
      timestamp: new Date(timestamp * 1000).toISOString(),
      close: close as number,
      volume: quote?.volume?.[index] ?? 0
    }
  }).filter((point): point is MarketPoint => Boolean(point))
}

async function fetchNewsEvidence(symbol: string, env: Env): Promise<EvidenceItem[]> {
  const rssUrl = env.GOOGLE_NEWS_RSS_URL ?? `https://news.google.com/rss/search?q=${encodeURIComponent(symbol)}&hl=tr&gl=TR&ceid=TR:tr`
  const response = await fetch(rssUrl)
  if (!response.ok) return []
  const xml = await response.text()
  const items = Array.from(xml.matchAll(/<item>[\s\S]*?<title><!\[CDATA\[(.*?)\]\]><\/title>[\s\S]*?<pubDate>(.*?)<\/pubDate>[\s\S]*?<\/item>/g)).slice(0, 10)
  return Promise.all(items.map(async (match, index) => {
    const title = decodeHtml(match[1] ?? `${symbol} news`)
    const timestamp = new Date(match[2] ?? Date.now()).toISOString()
    const classified = env.OPENAI_API_KEY ? await classifyText(title, env).catch(() => null) : null
    const sentiment = classified?.sentiment ?? inferSentiment(title)
    const impact = classified?.impact ?? (sentiment === 'neutral' ? 0.45 : 0.58)
    const relevance = classified?.relevance ?? (title.toLocaleUpperCase('tr-TR').includes(symbol) ? 0.75 : 0.35)
    return {
      id: `${Date.parse(timestamp)}-${index}`,
      timestamp,
      source: 'News',
      title,
      event_type: classified?.event_type ?? 'unclassified_news',
      sentiment,
      relevance,
      impact,
      novelty: classified?.novelty ?? 0.5,
      reason: classified?.reason ?? 'OpenAI classifier unavailable or not configured; rule-based fallback used.'
    }
  }))
}

async function classifyText(text: string, env: Env) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL ?? 'gpt-5-mini',
      input: `Classify this BIST financial text for research only. Do not predict price. Return JSON with relevance,event_type,sentiment,impact,novelty,time_sensitivity,confidence,reason.\n\n${text}`
    })
  })
  if (!response.ok) return null
  const payload = await response.json() as { output_text?: string }
  const parsed = JSON.parse(payload.output_text ?? '{}') as {
    relevance?: number
    event_type?: string
    sentiment?: 'positive' | 'neutral' | 'negative'
    impact?: number
    novelty?: number
    reason?: string
  }
  return parsed
}

function weightedScore(input: {
  kapScore: number
  newsScore: number
  technicalScore: number
  marketScore: number
  orderFlowScore: number | null
  anomalyScore: number
}) {
  if (input.orderFlowScore === null) {
    return roundScore(
      0.22 * input.kapScore +
      0.22 * input.newsScore +
      0.32 * input.technicalScore +
      0.19 * input.marketScore +
      0.05 * input.anomalyScore
    )
  }
  return roundScore(
    0.22 * input.kapScore +
    0.18 * input.newsScore +
    0.22 * input.technicalScore +
    0.15 * input.marketScore +
    0.18 * input.orderFlowScore +
    0.05 * input.anomalyScore
  )
}

function scoreMomentum(points: MarketPoint[]) {
  if (points.length < 3) return 50
  const first = points[0]!.close
  const last = points.at(-1)!.close
  const move = (last - first) / first
  return clampScore(50 + move * 800)
}

function scoreAnomaly(points: MarketPoint[]) {
  if (points.length < 10) return 50
  const volumes = points.map((point) => point.volume).filter((value) => value > 0)
  const latest = volumes.at(-1)
  if (!latest || volumes.length < 5) return 50
  const average = volumes.slice(0, -1).reduce((sum, value) => sum + value, 0) / (volumes.length - 1)
  return clampScore(50 + ((latest / Math.max(average, 1)) - 1) * 12)
}

function scoreNews(items: EvidenceItem[]) {
  if (!items.length) return 50
  const total = items.reduce((sum, item) => {
    const sign = item.sentiment === 'positive' ? 1 : item.sentiment === 'negative' ? -1 : 0
    return sum + sign * item.impact * item.relevance
  }, 0)
  return clampScore(50 + (total / items.length) * 40)
}

function confidenceFromScore(score: number, warningCount: number) {
  return Math.max(35, Math.min(82, Math.round(50 + Math.abs(score - 50) * 0.7 - warningCount * 4)))
}

function buildSummary(direction: Direction, score: number, dataQuality: SignalRecord['data_quality']) {
  if (dataQuality !== 'real') return `Signal is ${direction} with score ${score}, but data is ${dataQuality}; unavailable layers are not counted as real evidence.`
  return `Signal is ${direction} with score ${score} from available market, news, and context layers.`
}

function overallQuality(layerStatus: Record<string, DataQuality>): DataQuality {
  const statuses = Object.values(layerStatus)
  if (statuses.every((status) => status === 'real')) return 'real'
  if (statuses.some((status) => status === 'delayed' || status === 'real')) return 'insufficient'
  return 'unavailable'
}

function positiveFactors(news: number, technical: number, market: number) {
  return [
    news > 55 ? 'News layer is positive.' : '',
    technical > 55 ? 'Technical momentum is positive.' : '',
    market > 55 ? 'Market context is supportive.' : ''
  ].filter(Boolean)
}

function negativeFactors(news: number, technical: number, market: number) {
  return [
    news < 45 ? 'News layer is negative.' : '',
    technical < 45 ? 'Technical momentum is negative.' : '',
    market < 45 ? 'Market context is weak.' : ''
  ].filter(Boolean)
}

function inferSentiment(text: string): EvidenceItem['sentiment'] {
  const normalized = text.toLocaleLowerCase('tr-TR')
  if (/(ihale|sözleşme|anlaşma|kar|büyüme|teslimat|yeni)/.test(normalized)) return 'positive'
  if (/(zarar|iptal|ceza|dava|düşüş|soruşturma)/.test(normalized)) return 'negative'
  return 'neutral'
}

function decodeHtml(value: string) {
  return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}

function clampScore(value: number) {
  return roundScore(Math.max(0, Math.min(100, value)))
}

function roundScore(value: number) {
  return Number(value.toFixed(1))
}
