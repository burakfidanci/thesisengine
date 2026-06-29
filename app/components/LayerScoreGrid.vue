<script setup lang="ts">
import type { SignalRecord } from '../../shared/types'

const props = defineProps<{ signal: SignalRecord }>()

const layers = computed(() => [
  { label: 'KAP', value: props.signal.scores.kap_score, status: props.signal.layer_status?.kap ?? 'unavailable' },
  { label: 'Haber', value: props.signal.scores.news_score, status: props.signal.layer_status?.news ?? 'insufficient' },
  { label: 'Fiyat/Hacim', value: props.signal.price, status: props.signal.layer_status?.price_volume ?? 'insufficient' },
  { label: 'Teknik', value: props.signal.scores.technical_score, status: props.signal.layer_status?.technical ?? 'insufficient' },
  { label: 'Market Context', value: props.signal.scores.market_context_score, status: props.signal.layer_status?.market_context ?? 'insufficient' },
  { label: 'Order Flow', value: props.signal.scores.order_flow_score, status: props.signal.layer_status?.order_flow ?? 'unavailable' },
  { label: 'Anomaly', value: props.signal.scores.anomaly_score, status: props.signal.layer_status?.anomaly ?? 'insufficient' }
])

function displayValue(value: string | number | null) {
  if (value === null) return 'N/A'
  return typeof value === 'number' ? value.toFixed(value > 100 ? 2 : 1) : value
}

function meterWidth(value: string | number | null) {
  if (typeof value !== 'number') return 8
  return Math.max(8, Math.min(100, value))
}
</script>

<template>
  <section class="layer-grid">
    <div v-for="layer in layers" :key="layer.label" class="panel layer-card">
      <span>{{ layer.label }}</span>
      <strong>{{ displayValue(layer.value) }}</strong>
      <small :class="['status-badge', layer.status]">{{ layer.status }}</small>
      <div class="meter"><i :style="{ width: `${meterWidth(layer.value)}%` }" /></div>
    </div>
  </section>
</template>
