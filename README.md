# F1 Widget API

Cloudflare Worker backend for the F1 widget. It normalizes Jolpica data and uses Workers KV as a persistent request-driven cache.

## Production

Public API base URL:

```text
https://f1-widget-api.iqbalrahman-f1.workers.dev
```

The service uses the Cloudflare Workers Free plan, a free `workers.dev` hostname, and request-driven KV caching. No paid Cloudflare product or scheduled job is required.

## API

- `GET /v1/drivers`
- `GET /v1/drivers?search=vers` — searches ID, code, name, and driver number
- `GET /v1/races/next` — next-race or current race state without driver data
- `GET /v1/races/season-progress` — current-season completion totals and percentage
- `GET /v1/widget-snapshot?driverId=leclerc`
- `GET /healthz`

Example widget response:

```json
{
  "data": {
    "driverResultState": "available",
    "driverResult": {
      "driver": {
        "id": "leclerc",
        "code": "LEC",
        "givenName": "Charles",
        "familyName": "Leclerc",
        "permanentNumber": "16",
        "constructorName": "Ferrari"
      },
      "raceName": "British Grand Prix",
      "finishingPosition": 1,
      "gridPosition": 2,
      "positionsChanged": 1,
      "status": { "kind": "finished", "label": "Finished" }
    },
    "raceState": {
      "kind": "upcoming",
      "nextRace": {
        "raceName": "Belgian Grand Prix",
        "circuitName": "Circuit de Spa-Francorchamps",
        "locality": "Spa",
        "country": "Belgium",
        "scheduledDate": "2026-07-19",
        "startDate": "2026-07-19T13:00:00.000Z"
      }
    }
  },
  "meta": {
    "generatedAt": "2026-07-14T04:30:41.802Z",
    "stale": false,
    "scheduleUpdatedAt": "2026-07-14T04:30:41.802Z",
    "resultsUpdatedAt": "2026-07-14T04:30:41.802Z",
    "driversUpdatedAt": null
  }
}
```

The backend owns cache freshness. Clients never call Jolpica directly and do not send force-refresh commands.

| Dataset | Freshness |
| --- | --- |
| Schedule | 12 hours |
| Drivers | 7 days |
| Latest results | 24 hours normally; 1 hour after a race starts until its results appear |

When an entry is stale, the request attempts to refresh it before responding. If Jolpica fails, the last successful KV value is returned with `meta.stale: true`. A cold-cache failure returns HTTP 503.

## Local development

Requirements: Node.js 20 or newer and a Cloudflare account for deployment.

```bash
npm install
npm run dev
```

Wrangler persists local KV data under `.wrangler/`. Try:

```bash
curl http://localhost:8787/healthz
curl http://localhost:8787/v1/drivers
curl 'http://localhost:8787/v1/drivers?search=vers'
curl http://localhost:8787/v1/races/next
curl http://localhost:8787/v1/races/season-progress
curl 'http://localhost:8787/v1/widget-snapshot?driverId=leclerc'
```

Run verification:

```bash
npm run typecheck
npm test
```

## Deployment

Create a production KV namespace:

```bash
npx wrangler kv namespace create F1_CACHE
```

Replace the placeholder KV `id` in `wrangler.jsonc` with the ID printed by Wrangler, then deploy:

```bash
npm run deploy
```

No Cron Trigger is required. Cache refreshes are driven by app and widget requests.
