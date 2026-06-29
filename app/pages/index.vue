<script setup lang="ts">
import type { AccuracyMetrics, Direction, EvidenceItem, Horizon, SignalRecord } from '../../shared/types'

const rangeOptions = [
  { label: '1 gün', value: 1 },
  { label: '7 gün', value: 7 },
  { label: '30 gün', value: 30 }
]

const days = ref(30)
const symbol = 'ASELS'
const { data: historyData, pending } = await useFetch<{ records: SignalRecord[] }>('/api/history', {
  query: { days, symbol },
  watch: [days]
})
const { data: evidenceData } = await useFetch<EvidenceItem[]>('/api/evidence', {
  query: { days, symbol },
  watch: [days]
})
const { data: healthData } = await useFetch<{
  kv: string
  providers: Record<string, string>
  warnings: string[]
}>('/api/health')

const records = computed(() => historyData.value?.records ?? [])
const currentSignal = computed(() => records.value.at(-1))
const metrics = computed<AccuracyMetrics>(() => computeClientMetrics(records.value))

function computeClientMetrics(history: SignalRecord[]): AccuracyMetrics {
  const horizons: Horizon[] = ['15m', '1h', 'eod']
  const directions: Direction[] = ['UP', 'DOWN', 'NEUTRAL']
  const completed = history.filter((record) => horizons.some((horizon) => record.results[horizon]))
  const accuracy = Object.fromEntries(horizons.map((horizon) => {
    const rows = completed.filter((record) => record.results[horizon])
    const correct = rows.filter((record) => record.results[horizon]?.prediction_correct).length
    return [horizon, ratio(correct, rows.length)]
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
  const confidenceBuckets = Object.fromEntries(['50-60', '60-70', '70-80', '80+'].map((bucket) => {
    const pairs = resolvedPairs.filter((row) => inBucket(row.confidence, bucket))
    return [bucket, ratio(pairs.filter((row) => row.correct).length, pairs.length)]
  }))
  const ablationRows = completed.filter((record) => record.results['15m'])
  const ablationAccuracy = {
    news_only_score: ablationScore(ablationRows, 'news_only_score'),
    kap_news_score: ablationScore(ablationRows, 'kap_news_score'),
    technical_only_score: ablationScore(ablationRows, 'technical_only_score'),
    technical_plus_market_score: ablationScore(ablationRows, 'technical_plus_market_score'),
    full_model_score: ablationScore(ablationRows, 'full_model_score')
  }
  const layerScores = layerRanking(completed)

  return {
    total: completed.length,
    accuracy,
    directionAccuracy,
    averageConfidence: Math.round(average(confidences)),
    confidenceBuckets,
    brierLikeScore: Number((1 - average(Object.values(accuracy))).toFixed(3)),
    averageDirectionAlignment: Number(average(horizons.map((horizon) => accuracy[horizon])).toFixed(3)),
    bestLayer: layerScores[0]?.[0] ?? 'N/A',
    weakestLayer: layerScores.at(-1)?.[0] ?? 'N/A',
    ablationAccuracy
  }
}

function ablationScore(records: SignalRecord[], key: keyof SignalRecord['ablation']) {
  const correct = records.filter((record) => directionFromScore(record.ablation[key]) === record.results['15m']?.actual_direction).length
  return ratio(correct, records.length)
}

function directionFromScore(score: number): Direction {
  if (score >= 62) return 'UP'
  if (score <= 38) return 'DOWN'
  return 'NEUTRAL'
}

function inBucket(confidence: number, bucket: string) {
  if (bucket === '50-60') return confidence >= 50 && confidence < 60
  if (bucket === '60-70') return confidence >= 60 && confidence < 70
  if (bucket === '70-80') return confidence >= 70 && confidence < 80
  return confidence >= 80
}

function layerRanking(records: SignalRecord[]) {
  return Object.entries({
    KAP: average(records.map((record) => record.scores.kap_score)),
    Haber: average(records.map((record) => record.scores.news_score)),
    Teknik: average(records.map((record) => record.scores.technical_score)),
    'Market Context': average(records.map((record) => record.scores.market_context_score)),
    'Order Flow': average(records.map((record) => record.scores.order_flow_score ?? 50))
  }).sort((a, b) => b[1] - a[1])
}

function ratio(correct: number, total: number) {
  return total === 0 ? 0 : Number((correct / total).toFixed(3))
}

function average(values: number[]) {
  const safeValues = values.filter(Number.isFinite)
  return safeValues.length ? safeValues.reduce((sum, value) => sum + value, 0) / safeValues.length : 0
}
</script>

<template>
  <main class="page-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">Research dashboard</p>
        <h1>ASELS Signal Lab</h1>
        <p class="thesis">Profesyonel veri katmanları kısa vadeli yönü açıklayabiliyor mu?</p>
      </div>
      <div class="topbar-meta">
        <span>Delayed data: {{ currentSignal?.data_delay_minutes ?? 15 }} dk</span>
        <span>Son güncelleme: {{ currentSignal ? new Date(currentSignal.timestamp).toLocaleString('tr-TR') : '-' }}</span>
      </div>
    </header>

    <section class="toolbar">
      <UButton
        v-for="option in rangeOptions"
        :key="option.value"
        :color="days === option.value ? 'primary' : 'neutral'"
        :variant="days === option.value ? 'solid' : 'soft'"
        @click="days = option.value"
      >
        {{ option.label }}
      </UButton>
      <span v-if="pending" class="muted">Yükleniyor...</span>
    </section>

    <section class="grid two">
      <CurrentSignalCard v-if="currentSignal" :signal="currentSignal" />
      <section v-else class="panel empty-panel">
        <p class="eyebrow">No signal data</p>
        <h2>KV geçmişi henüz boş</h2>
        <p>Scheduled Worker gerçek provider kayıtlarını KV’ye yazdıktan sonra bu alan otomatik dolacak.</p>
      </section>
      <ThesisVerdict :metrics="metrics" />
    </section>

    <LayerScoreGrid v-if="currentSignal" :signal="currentSignal" />

    <section v-if="currentSignal" class="panel model-panel">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Model configuration</p>
          <h2>Weights and Data Status</h2>
        </div>
        <strong>{{ currentSignal.data_quality }}</strong>
      </div>
      <div class="config-grid">
        <div v-for="(value, key) in currentSignal.model_config.base_score_weights" :key="`base-${key}`">
          <span>base {{ key }}</span>
          <strong>{{ Math.round(value * 100) }}%</strong>
        </div>
        <div v-for="(value, key) in currentSignal.model_config.score_weights" :key="key">
          <span>active {{ key }}</span>
          <strong>{{ Math.round(value * 100) }}%</strong>
        </div>
      </div>
      <p class="muted">{{ currentSignal.model_config.redistribution_note }}</p>
      <p class="muted">{{ currentSignal.model_config.openai_role }}</p>
      <ul class="warning-list">
        <li v-for="warning in currentSignal.warnings" :key="warning">{{ warning }}</li>
      </ul>
    </section>

    <section class="panel model-panel">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Health</p>
          <h2>Provider Diagnostics</h2>
        </div>
        <strong>{{ healthData?.kv ?? 'unknown' }}</strong>
      </div>
      <div class="config-grid">
        <div v-for="(value, key) in healthData?.providers ?? {}" :key="key">
          <span>{{ key }}</span>
          <strong>{{ value }}</strong>
        </div>
      </div>
      <ul class="warning-list">
        <li v-for="warning in healthData?.warnings ?? []" :key="warning">{{ warning }}</li>
      </ul>
    </section>

    <section class="chart-section">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Historical price and signal marks</p>
          <h2>Fiyat Grafiği</h2>
        </div>
        <span>{{ records.length }} sinyal</span>
      </div>
      <PriceSignalChart :records="records" />
    </section>

    <section class="grid two">
      <AccuracyPanel :metrics="metrics" />
      <EvidenceFeed :items="evidenceData ?? []" />
    </section>

    <RecentSignalsTable :records="records" />

    <footer class="risk-note">
      Bu uygulama yatırım tavsiyesi vermez, emir göndermez ve yalnızca araştırma/hipotez testi içindir.
    </footer>
  </main>
</template>
