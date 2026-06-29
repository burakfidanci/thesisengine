<script setup lang="ts">
import type { SignalRecord } from '../../shared/types'

defineProps<{ records: SignalRecord[] }>()

function formatPrice(price: number | null) {
  return price === null ? 'N/A' : price.toFixed(2)
}

function resultLabel(result: SignalRecord['results']['15m']) {
  if (!result) return 'Pending'
  return `${result.actual_direction} · ${result.prediction_correct ? 'Doğru' : 'Yanlış'}`
}

function resultClass(result: SignalRecord['results']['15m']) {
  if (!result) return 'pending'
  return result.prediction_correct ? 'correct' : 'wrong'
}
</script>

<template>
  <section class="panel table-panel">
    <div class="section-heading">
      <div>
        <p class="eyebrow">All historical signals</p>
        <h2>Recent Signals</h2>
      </div>
    </div>

    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Zaman</th>
            <th>Fiyat</th>
            <th>15dk tahmin</th>
            <th>15dk sonuç</th>
            <th>1s tahmin</th>
            <th>1s sonuç</th>
            <th>EOD tahmin</th>
            <th>EOD sonuç</th>
            <th>Data</th>
            <th>Özet</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in records.slice().reverse()" :key="record.timestamp">
            <td>{{ new Date(record.timestamp).toLocaleString('tr-TR') }}</td>
            <td>{{ formatPrice(record.price) }}</td>
            <td>
              <span :class="['direction', record.predictions['15m'].direction.toLowerCase()]">
                {{ record.predictions['15m'].direction }} · {{ record.predictions['15m'].confidence }}%
              </span>
            </td>
            <td>
              <span :class="['result', resultClass(record.results['15m'])]">
                {{ resultLabel(record.results['15m']) }}
              </span>
            </td>
            <td>
              <span :class="['direction', record.predictions['1h'].direction.toLowerCase()]">
                {{ record.predictions['1h'].direction }} · {{ record.predictions['1h'].confidence }}%
              </span>
            </td>
            <td>
              <span :class="['result', resultClass(record.results['1h'])]">
                {{ resultLabel(record.results['1h']) }}
              </span>
            </td>
            <td>
              <span :class="['direction', record.predictions.eod.direction.toLowerCase()]">
                {{ record.predictions.eod.direction }} · {{ record.predictions.eod.confidence }}%
              </span>
            </td>
            <td>
              <span :class="['result', resultClass(record.results.eod)]">
                {{ resultLabel(record.results.eod) }}
              </span>
            </td>
            <td>{{ record.data_quality }}</td>
            <td>{{ record.explanation.summary }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
