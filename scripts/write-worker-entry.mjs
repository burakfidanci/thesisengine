import { mkdir, readFile, writeFile } from 'node:fs/promises'

const entry = `import nuxtWorker from './index.js'
import schedulerWorker from '../../workers/scheduled.ts'

export default {
  fetch: nuxtWorker.fetch.bind(nuxtWorker),
  scheduled: schedulerWorker.scheduled.bind(schedulerWorker)
}
`

const wranglerToml = await readFile('wrangler.toml', 'utf8')
const wranglerConfig = readWranglerConfig(wranglerToml)

await mkdir('dist/_worker.js', { recursive: true })
await writeFile('dist/_worker.js/scheduled-entry.js', entry)
await writeFile('dist/_worker.js/wrangler.json', `${JSON.stringify(wranglerConfig, null, 2)}\n`)
await writeFile('dist/.assetsignore', '_worker.js\nnitro.json\n')

function readWranglerConfig(toml) {
  const kvId = matchRequired(toml, /binding\s*=\s*"SIGNAL_KV"\s*,\s*id\s*=\s*"([^"]+)"/, 'SIGNAL_KV namespace id')
  const crons = Array.from(toml.matchAll(/"([^"]+\s+\*\s+\*\s+\*\s+\*)"/g)).map((match) => match[1])
  const varsBlock = toml.split('[vars]')[1] ?? ''
  const vars = Object.fromEntries(Array.from(varsBlock.matchAll(/^([A-Z0-9_]+)\s*=\s*"([^"]*)"/gm)).map((match) => [match[1], match[2]]))

  return {
    name: matchRequired(toml, /^name\s*=\s*"([^"]+)"/m, 'worker name'),
    main: 'scheduled-entry.js',
    compatibility_date: matchRequired(toml, /^compatibility_date\s*=\s*"([^"]+)"/m, 'compatibility date'),
    compatibility_flags: readArray(toml, 'compatibility_flags'),
    kv_namespaces: [
      { binding: 'SIGNAL_KV', id: kvId }
    ],
    triggers: {
      crons: crons.length ? crons : ['*/15 * * * *']
    },
    assets: {
      directory: '..',
      not_found_handling: 'none',
      run_worker_first: ['/', '/api/*']
    },
    vars
  }
}

function matchRequired(value, pattern, label) {
  const match = value.match(pattern)
  if (!match?.[1]) throw new Error(`Missing ${label} in wrangler.toml`)
  return match[1]
}

function readArray(toml, key) {
  const match = toml.match(new RegExp(`^${key}\\s*=\\s*\\[([^\\]]*)\\]`, 'm'))
  if (!match?.[1]) return []
  return Array.from(match[1].matchAll(/"([^"]+)"/g)).map((item) => item[1])
}
