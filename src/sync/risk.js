/**
 * sync/risk.js — syncs fire risk data from fogos.pt
 * Endpoints: /v1/risk-today and /v1/risk-tomorrow
 * Stores separate documents per date (today + tomorrow), each with its own level.
 */

import { Risk } from '../db/models.js'

const FOGOS_API = 'https://api.fogos.pt/v1'

async function fetchJSON (path) {
  const res = await fetch(`${FOGOS_API}${path}`, {
    signal: AbortSignal.timeout(15000),
    headers: { 'User-Agent': 'apiaberta-connector/1.0 (https://apiaberta.pt)' }
  })
  if (!res.ok) throw new Error(`fogos.pt ${path}: HTTP ${res.status}`)
  return res.json()
}

/**
 * Upserts risk records from a single fogos.pt /risk-{today|tomorrow} response.
 * @param {string} date - the forecast date (YYYY-MM-DD) from dataPrev
 * @param {object} localities - the `local` object from the API response
 */
async function upsertRiskDate (date, localities) {
  let count = 0
  for (const [dico, loc] of Object.entries(localities)) {
    const d = loc.data || {}
    await Risk.findOneAndUpdate(
      { dico, date },
      {
        dico,
        date,
        district:      resolveDistrict(dico),
        latitude:      loc.latitude ?? null,
        longitude:     loc.longitude ?? null,
        level:         d.ff_int_id ?? null,    // fire risk level 1-5
        fire_weather_index: d.ff_int_id ?? null,
        temperature_max: d.tMax ?? null,
        temperature_min: d.tMin ?? null,
        humidity_max:   d.hrMax ?? null,
        humidity_min:   d.hrMin ?? null,
        wind_direction: d.ff_dir_id ?? null,
        precipitation_risk: d.rr_id ?? null,
        rcm:            d.rcm ?? null,
        synced_at:      new Date()
      },
      { upsert: true }
    )
    count++
  }
  return count
}

export async function syncRisk () {
  const results = {}

  const [todayJson, tomorrowJson] = await Promise.all([
    fetchJSON('/risk-today'),
    fetchJSON('/risk-tomorrow')
  ])

  if (todayJson.success) {
    results.today = await upsertRiskDate(todayJson.data.dataPrev, todayJson.data.local || {})
  }
  if (tomorrowJson.success) {
    results.tomorrow = await upsertRiskDate(tomorrowJson.data.dataPrev, tomorrowJson.data.local || {})
  }

  return results
}

// ─── District resolution from DICO prefix ────────────────────────────────────

const DICO_PREFIX_MAP = {
  '01': 'Aveiro', '02': 'Beja', '03': 'Braga', '04': 'Bragança',
  '05': 'Castelo Branco', '06': 'Coimbra', '07': 'Évora', '08': 'Faro',
  '09': 'Guarda', '10': 'Leiria', '11': 'Lisboa', '12': 'Portalegre',
  '13': 'Porto', '14': 'Santarém', '15': 'Setúbal',
  '16': 'Viana do Castelo', '17': 'Vila Real', '18': 'Viseu',
  '20': 'Região Autónoma da Madeira', '30': 'Região Autónoma dos Açores'
}

function resolveDistrict (dico) {
  const prefix = String(dico).padStart(4, '0').slice(0, 2)
  return DICO_PREFIX_MAP[prefix] ?? `Unknown-${dico}`
}
