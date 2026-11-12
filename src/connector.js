/**
 * connector-anpc — fetches civil protection incidents from fogos.pt API
 * Source: https://api.fogos.pt (aggregates ANEPC/ICNF data)
 */

import { Incident as IncidentModel } from './db/models.js'
import { bulkWriteInBatches } from './db/bulk.js'
import { FOGOS_V2, fetchFogosJSON } from './fogos.js'
import { buildIncidentBulkOps } from './incidents.js'

export async function fetchActiveIncidents ({
    fetchJSON = (path) => fetchFogosJSON(FOGOS_V2, path),
    Incident = IncidentModel,
    now = new Date()
} = {}) {
    const json = await fetchJSON('/incidents/active')
    if (!json.success) throw new Error('fogos.pt API returned success=false')

    const incidents = json.data || []
    const { ops, activeIds } = buildIncidentBulkOps(incidents, now)
    await bulkWriteInBatches(Incident, ops)

    const marked = await Incident.updateMany(
        { active: true, incident_id: { $nin: activeIds } },
        { $set: { active: false } }
    )

    return { upserted: ops.length, deactivated: marked.modifiedCount }
}
