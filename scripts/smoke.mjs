const baseUrl = process.env.SMOKE_BASE_URL
const requireSignal = process.env.SMOKE_REQUIRE_SIGNAL !== 'false'

if (!baseUrl) {
  console.error('SMOKE_BASE_URL is required. Example: SMOKE_BASE_URL=https://signallab.pages.dev npm run smoke')
  process.exit(1)
}

const base = baseUrl.replace(/\/$/, '')
const failures = []

const health = await getJson(`${base}/api/health`, 'health')
if (health) {
  expect(health.status === 'ok', 'health status is ok')
  expect(health.kv === 'configured', 'KV is connected')
  expect(['configured', 'unavailable'].includes(health.providers?.openai_classifier), 'OpenAI status is shown')
  expect(Boolean(health.providers?.price_volume), 'market provider status is shown')
  expect(Boolean(health.providers?.news), 'news provider status is shown')
  expect(health.providers?.kap === 'unavailable', 'KAP is shown as unavailable')
  expect(health.providers?.order_flow === 'unavailable', 'order-flow is shown as unavailable')
}

const history = await getJson(`${base}/api/history?symbol=ASELS&days=30`, 'history')
if (history) {
  expect(Array.isArray(history.records), 'history returns records array')
  if (requireSignal) {
    expect(history.records.length > 0, 'history contains at least one KV signal')
  }

  const latest = history.records?.at?.(-1)
  if (latest) {
    expect(Boolean(latest.data_quality), 'latest signal includes data_quality')
    expect(Array.isArray(latest.warnings), 'latest signal includes warnings')
    expect(Boolean(latest.layer_status), 'latest signal includes layer_status')
    expect(latest.layer_status?.kap === 'unavailable', 'latest signal marks KAP unavailable')
    expect(latest.layer_status?.order_flow === 'unavailable', 'latest signal marks order-flow unavailable')
    expect(!resultLooksWrongWhenPending(latest.results?.['15m']), 'pending 15m is not encoded as wrong')
  }
}

const dashboard = await fetch(`${base}/`)
expect(dashboard.ok, 'dashboard route returns HTTP 2xx')

if (failures.length) {
  console.error(`Smoke test failed:\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

console.log('Smoke test passed.')

async function getJson(url, label) {
  try {
    const response = await fetch(url)
    expect(response.ok, `${label} endpoint returns HTTP 2xx`)
    if (!response.ok) return null
    return await response.json()
  } catch (error) {
    failures.push(`${label} endpoint failed: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

function expect(condition, message) {
  if (!condition) failures.push(message)
}

function resultLooksWrongWhenPending(result) {
  return result === undefined ? false : result.prediction_correct === false && !result.actual_direction
}
