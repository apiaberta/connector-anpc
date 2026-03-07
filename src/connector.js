/**
 * connector-anpc — fetches civil protection incidents from fogos.pt API
 * Source: https://api.fogos.pt (aggregates ANEPC/ICNF data)
 */

import { Incident } from './db/models.js'

const FOGOS_API = 'https://api.fogos.pt/v2'

async function fetchJSON (path) {
  const res = await fetch(`${FOGOS_API}${path}`, {
    signal: AbortSignal.timeout(15000),
    headers: { 'User-Agent': 'apiaberta-connector/1.0 (https://apiaberta.pt)' }
  })
  if (!res.ok) throw new Error(`fogos.pt ${path}: HTTP ${res.status}`)
  return res.json()
}

export async function fetchActiveIncidents () {
  const json = await fetchJSON('/incidents/active')
  if (!json.success) throw new Error('fogos.pt API returned success=false')

  const incidents = json.data || []
  let upserted = 0

  for (const inc of incidents) {
    const datetime = inc.dateTime?.sec ? new Date(inc.dateTime.sec * 1000) : null

    await Incident.findOneAndUpdate(
      { incident_id: String(inc.id) },
      {
        incident_id:   String(inc.id),
        date:          inc.date,
        datetime,
        natureza:      inc.natureza,
        natureza_code: inc.naturezaCode,
        status:        inc.status,
        status_code:   String(inc.statusCode),
        active:        inc.active ?? true,
        district:      inc.district,
        concelho:      inc.concelho,
        freguesia:     inc.freguesia,
        location:      inc.location || inc.localidade,
        lat:           inc.lat,
        lng:           inc.lng,
        regiao:        inc.regiao,
        sub_regiao:    inc.sub_regiao,
        meios_terra:   inc.terrain ?? 0,
        meios_aereos:  (inc.aerial ?? 0) + (inc.heliFight ?? 0) + (inc.planeFight ?? 0),
        meios_agua:    inc.meios_aquaticos ?? 0,
        last_seen:     new Date()
      },
      { upsert: true }
    )
    upserted++
  }

  // Mark previously active incidents that no longer appear as inactive
  const activeIds = incidents.map(i => String(i.id))
  const marked = await Incident.updateMany(
    { active: true, incident_id: { $nin: activeIds } },
    { $set: { active: false } }
  )

  return { upserted, deactivated: marked.modifiedCount }
}
