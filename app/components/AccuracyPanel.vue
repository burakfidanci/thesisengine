<script setup lang="ts">
import type { AccuracyMetrics } from '../../shared/types'

defineProps<{ metrics: AccuracyMetrics }>()
</script>

<template>
  <section class="panel">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Backtest accuracy</p>
        <h2>Başarı Paneli</h2>
      </div>
      <strong>{{ metrics.total }}</strong>
    </div>

    <div class="metric-row">
      <span>15dk</span>
      <strong>{{ Math.round(metrics.accuracy['15m'] * 100) }}%</strong>
    </div>
    <div class="metric-row">
      <span>1s</span>
      <strong>{{ Math.round(metrics.accuracy['1h'] * 100) }}%</strong>
    </div>
    <div class="metric-row">
      <span>EOD</span>
      <strong>{{ Math.round(metrics.accuracy.eod * 100) }}%</strong>
    </div>
    <div class="metric-row">
      <span>Ortalama confidence</span>
      <strong>{{ metrics.averageConfidence }}%</strong>
    </div>
    <div class="metric-row">
      <span>Brier benzeri skor</span>
      <strong>{{ metrics.brierLikeScore }}</strong>
    </div>

    <div class="metric-row">
      <span>UP / DOWN / NEUTRAL</span>
      <strong>
        {{ Math.round(metrics.directionAccuracy.UP * 100) }}% /
        {{ Math.round(metrics.directionAccuracy.DOWN * 100) }}% /
        {{ Math.round(metrics.directionAccuracy.NEUTRAL * 100) }}%
      </strong>
    </div>

    <div class="ablation-list">
      <div v-for="(value, label) in metrics.ablationAccuracy" :key="label">
        <span>{{ label }}</span>
        <strong>{{ Math.round(value * 100) }}%</strong>
      </div>
    </div>

    <div class="ablation-list">
      <div v-for="(value, label) in metrics.confidenceBuckets" :key="label">
        <span>Confidence {{ label }}</span>
        <strong>{{ Math.round(value * 100) }}%</strong>
      </div>
    </div>
  </section>
</template>
