<script setup lang="ts">
import type { AccuracyMetrics } from '../../shared/types'

const props = defineProps<{ metrics: AccuracyMetrics }>()

const verdict = computed(() => {
  if (props.metrics.total < 30) return 'Insufficient data: at least 30 resolved signals are required before evaluating the thesis.'
  if (props.metrics.averageDirectionAlignment > 0.55) return 'Şu ana kadar veri, full modelin rastgele tahminden daha iyi olabileceğini destekliyor.'
  return 'Şu ana kadar veri tezi güçlü biçimde desteklemiyor; daha uzun örneklem gerekli.'
})
</script>

<template>
  <section class="panel verdict-panel">
    <p class="eyebrow">Thesis verdict</p>
    <h2>{{ verdict }}</h2>
    <p>En başarılı katman: {{ metrics.bestLayer }}. En zayıf katman: {{ metrics.weakestLayer }}.</p>
  </section>
</template>
