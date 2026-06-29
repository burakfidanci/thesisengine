<script setup lang="ts">
import type { SignalRecord } from '../../shared/types'

const props = defineProps<{ records: SignalRecord[] }>()

const width = 900
const height = 320
const padding = 28

const points = computed(() => {
  if (!props.records.length) return []
  const chartRecords = props.records.filter((record) => record.price !== null)
  const prices = chartRecords.map((record) => record.price as number)
  if (!prices.length) return []
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const span = Math.max(max - min, 0.01)
  return chartRecords.map((record, index) => ({
    record,
    x: padding + (index / Math.max(chartRecords.length - 1, 1)) * (width - padding * 2),
    y: height - padding - (((record.price as number) - min) / span) * (height - padding * 2)
  }))
})

const linePath = computed(() => points.value.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' '))

function markerClass(record: SignalRecord) {
  const result = record.results['15m']
  if (!result) return 'neutral'
  if (record.predictions['15m'].direction === 'NEUTRAL') return 'neutral'
  return result.prediction_correct ? 'correct' : 'wrong'
}
</script>

<template>
  <div class="chart-wrap">
    <div v-if="!points.length" class="empty-chart">Seçilen aralıkta çizilebilir gerçek fiyat yok.</div>
    <svg viewBox="0 0 900 320" role="img" aria-label="ASELS fiyat ve sinyal grafiği">
      <path class="grid-line" d="M 28 72 L 872 72 M 28 160 L 872 160 M 28 248 L 872 248" />
      <path class="price-line" :d="linePath" />
      <g v-for="point in points" :key="point.record.timestamp">
        <circle
          :class="['signal-dot', markerClass(point.record)]"
          :cx="point.x"
          :cy="point.y"
          r="4.5"
        >
          <title>{{ new Date(point.record.timestamp).toLocaleString('tr-TR') }} - {{ point.record.predictions['15m'].direction }}</title>
        </circle>
      </g>
    </svg>
    <div class="legend">
      <span><i class="legend-dot correct" /> doğru</span>
      <span><i class="legend-dot wrong" /> yanlış</span>
      <span><i class="legend-dot neutral" /> neutral</span>
    </div>
  </div>
</template>
