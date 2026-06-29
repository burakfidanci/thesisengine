<script setup lang="ts">
import type { EvidenceItem } from '../../shared/types'

defineProps<{ items: EvidenceItem[] }>()
</script>

<template>
  <section class="panel evidence-panel">
    <div class="section-heading">
      <div>
        <p class="eyebrow">KAP / news classification</p>
        <h2>Evidence Feed</h2>
      </div>
    </div>
    <article v-for="item in items" :key="item.id" class="evidence-item">
      <div>
        <span :class="['source', item.source.toLowerCase()]">{{ item.source }}</span>
        <strong>{{ item.title }}</strong>
      </div>
      <p>{{ item.reason }}</p>
      <small>{{ item.event_type }} · relevance {{ Math.round(item.relevance * 100) }} · impact {{ Math.round(item.impact * 100) }}</small>
    </article>
  </section>
</template>
