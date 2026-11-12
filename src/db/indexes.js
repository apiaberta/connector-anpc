/**
 * Explicit MongoDB indexes for connector-anpc.
 *
 * Created on every startup by ensureIndexes(). collection.createIndex is
 * idempotent: the same keys + options are a no-op, so this is safe to re-run.
 *
 * autoIndex is disabled; do not rely on mongoose schema.index() to build these.
 * Unique constraints below match the schema fields (incident_id, sourceId, dico+date).
 *
 * Query shapes these indexes cover (see README):
 *   incidents: { active: true } sort { datetime: -1 }  → active_1_datetime_-1
 *   incidents: upsert / $nin by incident_id            → incident_id_1
 *   warnings:  sort { syncedAt: -1 } + skip/limit      → syncedAt_-1
 *   warnings:  upsert by sourceId                      → sourceId_1
 */

import { Incident, Risk, Warning } from './models.js'

export const LATEST_ACTIVE_HINT = { active: 1, datetime: -1 }

export const INDEXES = {
    incidents: [
        {
            keys: { incident_id: 1 },
            options: { unique: true, name: 'incident_id_1' },
            purpose: 'Upsert and deactivate by fogos.pt incident id'
        },
        {
            keys: { active: 1, datetime: -1 },
            options: { name: 'active_1_datetime_-1' },
            purpose: 'Latest-active (meta), list/sort, count, summary $match — avoids scanning all history'
        },
        {
            keys: { datetime: -1 },
            options: { name: 'datetime_-1' },
            purpose: 'Date-range scans without an active filter (kept for compatibility)'
        },
        {
            keys: { district: 1, active: 1 },
            options: { name: 'district_1_active_1' },
            purpose: 'Exact district + active lookups'
        },
        {
            keys: { natureza_code: 1 },
            options: { name: 'natureza_code_1' },
            purpose: 'Filter by ANEPC natureza code'
        }
    ],
    warnings: [
        {
            keys: { sourceId: 1 },
            options: { unique: true, name: 'sourceId_1' },
            purpose: 'Upsert by fogos.pt warning id'
        },
        {
            keys: { syncedAt: -1 },
            options: { name: 'syncedAt_-1' },
            purpose: 'GET /anpc/warnings sort + skip/limit'
        }
    ],
    risks: [
        {
            keys: { dico: 1, date: 1 },
            options: { unique: true, name: 'dico_1_date_1' },
            purpose: 'Upsert one forecast per municipality and date'
        },
        {
            keys: { date: 1, district: 1, dico: 1 },
            options: { name: 'date_1_district_1_dico_1' },
            purpose: 'GET /anpc/risk { date } sort { district, dico }'
        },
        {
            keys: { date: 1, level: -1 },
            options: { name: 'date_1_level_-1' },
            purpose: 'Risk by date ordered by level'
        },
        {
            keys: { district: 1, date: 1 },
            options: { name: 'district_1_date_1' },
            purpose: 'Exact district + date lookups'
        }
    ]
}

const MODEL_BY_COLLECTION = {
    incidents: () => Incident,
    warnings: () => Warning,
    risks: () => Risk
}

export function allIndexSpecs () {
    return Object.entries(INDEXES).flatMap(([collection, specs]) =>
        specs.map(spec => ({ collection, ...spec }))
    )
}

/**
 * Create every declared index. Idempotent: MongoDB createIndex is a no-op when
 * the same keys and options already exist.
 *
 * @param {object} [models] optional model map for tests (never a production client)
 */
export async function ensureIndexes (models = {}) {
    const created = []
    for (const [collection, specs] of Object.entries(INDEXES)) {
        const Model = models[collection] ?? MODEL_BY_COLLECTION[collection]()
        for (const spec of specs) {
            const name = await Model.collection.createIndex(spec.keys, spec.options)
            created.push({ collection, name })
        }
    }
    return created
}
