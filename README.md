# connector-anpc

Civil protection incidents connector for API Aberta.

Data source: [fogos.pt](https://api.fogos.pt) (aggregates ANEPC/ICNF official data)

Updated every **5 minutes**.

## Endpoints

- `GET /v1/anpc/incidents/active` — all currently active incidents
- `GET /v1/anpc/incidents?district=Lisboa&active=true&page=1` — paginated list with filters
- `GET /v1/anpc/summary` — counts by district and incident type

## Filters (incidents endpoint)

| Parameter | Description |
|-----------|-------------|
| `active` | `true`/`false` (default: `true`) |
| `district` | District name (case-insensitive) |
| `natureza` | Incident type (e.g. `Mato`, `Florestal`) |
| `from` | ISO datetime filter |
| `to` | ISO datetime filter |
| `page`, `limit` | Pagination |
