/**
 * sync/risk.js — syncs fire risk data from fogos.pt
 * Endpoints: /v1/risk-today and /v1/risk-tomorrow
 * Stores separate documents per date (today + tomorrow), each with its own level.
 */

import { Risk as RiskModel } from '../db/models.js'
import { bulkWriteInBatches } from '../db/bulk.js'
import { FOGOS_V1, fetchFogosJSON } from '../fogos.js'

const DICO_PREFIX_MAP = {
    '01': 'Aveiro', '02': 'Beja', '03': 'Braga', '04': 'Bragança',
    '05': 'Castelo Branco', '06': 'Coimbra', '07': 'Évora', '08': 'Faro',
    '09': 'Guarda', '10': 'Leiria', '11': 'Lisboa', '12': 'Portalegre',
    '13': 'Porto', '14': 'Santarém', '15': 'Setúbal',
    '16': 'Viana do Castelo', '17': 'Vila Real', '18': 'Viseu',
    '20': 'Região Autónoma da Madeira', '30': 'Região Autónoma dos Açores'
}

export function resolveDistrict (dico) {
    const prefix = String(dico).padStart(4, '0').slice(0, 2)
    return DICO_PREFIX_MAP[prefix] ?? `Unknown-${dico}`
}

export function mapRiskLocality (dico, loc, date, now = new Date()) {
    const d = loc.data || {}
    return {
        dico,
        date,
        district:           resolveDistrict(dico),
        latitude:           loc.latitude ?? null,
        longitude:          loc.longitude ?? null,
        level:              d.ff_int_id ?? null,
        fire_weather_index: d.ff_int_id ?? null,
        temperature_max:    d.tMax ?? null,
        temperature_min:    d.tMin ?? null,
        humidity_max:       d.hrMax ?? null,
        humidity_min:       d.hrMin ?? null,
        wind_direction:     d.ff_dir_id ?? null,
        precipitation_risk: d.rr_id ?? null,
        rcm:                d.rcm ?? null,
        synced_at:          now
    }
}

export function buildRiskBulkOps (date, localities, now = new Date()) {
    const ops = []
    for (const [dico, loc] of Object.entries(localities || {})) {
        const doc = mapRiskLocality(dico, loc, date, now)
        ops.push({
            updateOne: {
                filter: { dico, date },
                update: { $set: doc },
                upsert: true
            }
        })
    }
    return ops
}

async function upsertRiskDate (date, localities, Risk, now) {
    const ops = buildRiskBulkOps(date, localities, now)
    await bulkWriteInBatches(Risk, ops)
    return ops.length
}

export async function syncRisk ({
    fetchJSON = (path) => fetchFogosJSON(FOGOS_V1, path),
    Risk = RiskModel,
    now = new Date()
} = {}) {
    const results = {}

    const [todayJson, tomorrowJson] = await Promise.all([
        fetchJSON('/risk-today'),
        fetchJSON('/risk-tomorrow')
    ])

    if (todayJson.success) {
        results.today = await upsertRiskDate(
            todayJson.data.dataPrev,
            todayJson.data.local || {},
            Risk,
            now
        )
    }
    if (tomorrowJson.success) {
        results.tomorrow = await upsertRiskDate(
            tomorrowJson.data.dataPrev,
            tomorrowJson.data.local || {},
            Risk,
            now
        )
    }

    return results
}
