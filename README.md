# API Aberta — Civil Protection Connector (ANPC)

Microservice for civil protection alerts and emergency information.

## Features

- Active incidents (fires, floods, rescue operations)
- Fire risk index
- Road/traffic warnings
- Satellite hotspots (proxied)

## Endpoints

- `GET /health` — Service health check
- `GET /meta` / `GET /anpc/meta` — Service metadata
- `GET /anpc/incidents` — Incidents (filters: `active`, `district`, `natureza`, `from`, `to`, `page`, `limit`)
- `GET /anpc/incidents/active` — Active incidents only
- `GET /anpc/summary` — Active counts by district and type
- `GET /anpc/warnings` — Road/traffic warnings (`page`, `limit`)
- `GET /anpc/risk` — Fire risk by municipality
- `GET /anpc/hotspots` — Satellite hotspots (proxied from fogos.pt)

Public response shapes are unchanged in v1.2.0.

## Setup

```bash
npm install
cp .env.example .env
npm start
```

`MONGO_URI` defaults to `mongodb://localhost:27017/apiaberta-anpc`. Tests (`NODE_ENV=test`) and non-production runs refuse a non-local MongoDB host so they never touch production.

```bash
npm test
```

Tests are mocks and fixtures only: they do not connect to MongoDB.

## MongoDB indexes

Indexes are created on every startup by `ensureIndexes()` in `src/db/indexes.js`. Mongoose `autoIndex` is off. `collection.createIndex` is **idempotent**: the same keys and options are a no-op, so re-running on boot is safe and does not drop anything.

| Collection | Index | Keys | Query it covers |
|---|---|---|---|
| `incidents` | `incident_id_1` (unique) | `{ incident_id: 1 }` | Upsert / deactivate by fogos.pt id |
| `incidents` | `active_1_datetime_-1` | `{ active: 1, datetime: -1 }` | Latest active (meta), list + sort, count, summary `$match` |
| `incidents` | `datetime_-1` | `{ datetime: -1 }` | Date-range scans without `active` (kept for compatibility) |
| `incidents` | `district_1_active_1` | `{ district: 1, active: 1 }` | Exact district + active |
| `incidents` | `natureza_code_1` | `{ natureza_code: 1 }` | Filter by natureza code |
| `warnings` | `sourceId_1` (unique) | `{ sourceId: 1 }` | Upsert by fogos.pt id |
| `warnings` | `syncedAt_-1` | `{ syncedAt: -1 }` | `GET /anpc/warnings` sort + skip/limit |
| `risks` | `dico_1_date_1` (unique) | `{ dico: 1, date: 1 }` | Upsert per municipality + date |
| `risks` | `date_1_district_1_dico_1` | `{ date: 1, district: 1, dico: 1 }` | `GET /anpc/risk` by date, sort district/dico |
| `risks` | `date_1_level_-1` | `{ date: 1, level: -1 }` | Risk by date ordered by level |
| `risks` | `district_1_date_1` | `{ district: 1, date: 1 }` | Exact district + date |

The production incident that examined all ~13k `incidents` to return 1 used `{ datetime: -1 }` for `find({ active: true }).sort({ datetime: -1 }).limit(1)`. `active_1_datetime_-1` serves that equality + sort so MongoDB can seek to the newest active document.

After deploy, confirm with:

```javascript
db.incidents.getIndexes()
db.incidents.find({ active: true }).sort({ datetime: -1 }).limit(1)
  .hint({ active: 1, datetime: -1 })
  .explain('executionStats')
// executionStats.totalDocsExamined should be 1
```

Jobs (incidents every 5 min, warnings every 5 min, risk every 6 h) write with `bulkWrite` in batches of 200 (`WRITE_BATCH_SIZE`) instead of per-document `findOneAndUpdate`. Reads use projections and the list endpoints keep their existing `limit` caps.

## Data Source

ANPC (Autoridade Nacional de Emergência e Proteção Civil) via [fogos.pt](https://api.fogos.pt).

## License

MIT
