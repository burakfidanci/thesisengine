# SignalLab

Single-stock BIST research dashboard for ASELS / ASELS.IS.

SignalLab tests whether professional-style data layers can explain short-term direction for one stock. It is not a trading bot, does not place orders, and must not be used as investment advice.

## Runtime

- Nuxt 4 + Nuxt UI dashboard
- Cloudflare Pages for the dashboard/API
- Cloudflare Worker cron for 15-minute signal generation and result resolution
- Cloudflare KV binding: `SIGNAL_KV`

The app deploys even when real providers are missing. In that case records are marked `unavailable` or `insufficient`, warnings are shown in the dashboard, and accuracy is not fabricated.

## Required Commands

```bash
npm install
npm run lint
npm run typecheck
npm run build
npx wrangler deploy --dry-run
```

## Cloudflare Setup

1. Create a KV namespace:

```bash
npx wrangler kv namespace create SIGNAL_KV
```

2. Put the returned namespace id in `wrangler.toml`:

```toml
kv_namespaces = [
  { binding = "SIGNAL_KV", id = "<real-kv-namespace-id>" }
]
```

3. Add secrets when available:

```bash
npx wrangler secret put OPENAI_API_KEY
```

4. Deploy the scheduled Worker:

```bash
npx wrangler deploy
```

5. Deploy the Nuxt dashboard to Pages:

```bash
npm run build
npx wrangler pages deploy dist --project-name signallab
```

6. In the Cloudflare Pages project, bind the same KV namespace as `SIGNAL_KV`.

## Provider Notes

- OpenAI is used only as a structured KAP/news text classifier.
- Missing KAP/news/order-flow providers are shown as warnings.
- Order-flow is disabled by default and its weight is redistributed to technical, market context, and news layers.

## Production Smoke Test

Set the live dashboard URL first:

```bash
export SMOKE_BASE_URL="https://signallab.pages.dev"
```

Run the read-only live smoke test:

```bash
npm run smoke
```

The smoke script verifies:

- `/api/health` returns `status: "ok"`
- `SIGNAL_KV` is connected
- OpenAI classifier status is shown as `configured` or `unavailable`
- price/volume, market context, and news provider statuses are shown
- KAP is explicitly `unavailable`
- order-flow is explicitly `unavailable`
- `/api/history?symbol=ASELS&days=30` reads KV-backed records
- the latest signal includes `data_quality`, `warnings`, and `layer_status`
- pending results are not encoded as wrong
- the dashboard route returns HTTP 2xx

Before the first scheduled run, allow an empty KV history check:

```bash
SMOKE_REQUIRE_SIGNAL=false npm run smoke
```

Manually trigger the scheduled Worker locally:

```bash
npx wrangler dev --test-scheduled --local --persist-to .wrangler/state
```

In another terminal:

```bash
curl "http://localhost:8787/__scheduled"
```

Verify local KV has at least one signal key:

```bash
npx wrangler kv key list --binding SIGNAL_KV --prefix "signal:ASELS:" --local --persist-to .wrangler/state
```

After deploying the scheduled Worker, verify remote KV has at least one signal key:

```bash
npx wrangler kv key list --binding SIGNAL_KV --prefix "signal:ASELS:" --remote
```

Confirm the dashboard can read the signal from KV:

```bash
curl "$SMOKE_BASE_URL/api/history?symbol=ASELS&days=30"
npm run smoke
```

Confirm pending predictions are shown as pending, not wrong:

```bash
curl "$SMOKE_BASE_URL/api/history?symbol=ASELS&days=30" | node -e '
let body = "";
process.stdin.on("data", c => body += c);
process.stdin.on("end", () => {
  const latest = JSON.parse(body).records.at(-1);
  for (const horizon of ["15m", "1h", "eod"]) {
    const result = latest.results[horizon];
    console.log(horizon, result ? result.prediction_correct : "pending");
  }
});
'
```

After enough time passes, verify result resolution has started:

```bash
curl "$SMOKE_BASE_URL/api/history?symbol=ASELS&days=30" | node -e '
let body = "";
process.stdin.on("data", c => body += c);
process.stdin.on("end", () => {
  const records = JSON.parse(body).records;
  for (const horizon of ["15m", "1h", "eod"]) {
    const resolved = records.filter(record => record.results[horizon]).length;
    console.log(`result_${horizon}: ${resolved}`);
  }
});
'
```

Metrics exclude pending results by design. Confirm resolved counts and metric totals together:

```bash
curl "$SMOKE_BASE_URL/api/metrics?symbol=ASELS&days=30"
```
# thesisengine
