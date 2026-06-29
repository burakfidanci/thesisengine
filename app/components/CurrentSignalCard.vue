<script setup lang="ts">
import type { SignalRecord } from '../../shared/types'

defineProps<{ signal: SignalRecord }>()
</script>

<template>
  <section class="panel current-panel">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Current signal</p>
        <h2>{{ signal.symbol }} @ {{ signal.price === null ? 'N/A' : signal.price.toFixed(2) }}</h2>
      </div>
      <strong :class="['score-pill', signal.scores.final_score >= 62 ? 'up' : signal.scores.final_score <= 38 ? 'down' : 'neutral']">
        {{ signal.scores.final_score }}
      </strong>
    </div>

    <div class="horizon-grid">
      <div v-for="(prediction, horizon) in signal.predictions" :key="horizon" class="horizon-card">
        <span>{{ horizon }}</span>
        <strong :class="prediction.direction.toLowerCase()">{{ prediction.direction }}</strong>
        <small>{{ prediction.confidence }}% confidence</small>
      </div>
    </div>

    <p class="summary">{{ signal.explanation.summary }}</p>
    <p v-if="signal.warnings.length" class="summary">{{ signal.warnings[0] }}</p>
  </section>
</template>
