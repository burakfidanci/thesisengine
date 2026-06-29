import { mkdir, writeFile } from 'node:fs/promises'

const entry = `import nuxtWorker from './index.js'
import schedulerWorker from '../../workers/scheduled.ts'

export default {
  fetch: nuxtWorker.fetch.bind(nuxtWorker),
  scheduled: schedulerWorker.scheduled.bind(schedulerWorker)
}
`

const wranglerConfig = {
  name: 'thesisengine-scheduler',
  main: 'scheduled-entry.js',
  compatibility_date: '2026-06-24',
  kv_namespaces: [
    { binding: 'SIGNAL_KV', id: 'replace-with-kv-id' }
  ],
  triggers: {
    crons: ['*/15 * * * *']
  },
  vars: {
    SYMBOL: 'ASELS',
    SYMBOL_YAHOO: 'ASELS.IS',
    OPENAI_MODEL: 'gpt-5-mini',
    GOOGLE_NEWS_RSS_URL: 'https://news.google.com/rss/search?q=ASELS&hl=tr&gl=TR&ceid=TR:tr',
    DATA_DELAY_MINUTES: '15',
    XU100_SYMBOL: 'XU100.IS',
    ORDER_FLOW_ENABLED: 'false'
  }
}

await mkdir('dist/_worker.js', { recursive: true })
await writeFile('dist/_worker.js/scheduled-entry.js', entry)
await writeFile('dist/_worker.js/wrangler.json', `${JSON.stringify(wranglerConfig, null, 2)}\n`)
