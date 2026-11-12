/**
 * sync/warnings.js — syncs road/traffic warnings from fogos.pt
 * Endpoint: /v1/warnings
 * Returns road-cut and emergency notices from ANEPC/VOST
 */

import { Warning as WarningModel } from '../db/models.js'
import { bulkWriteInBatches } from '../db/bulk.js'
import { FOGOS_V1, fetchFogosJSON } from '../fogos.js'

export function mapFogosWarning (item, now = new Date()) {
    const sourceId = item._id?.$id ?? item._id ?? null
    if (sourceId == null || sourceId === '') return null
    return {
        sourceId: String(sourceId),
        text:     item.text ?? '',
        label:    item.label ?? '',
        source:   'fogos.pt',
        syncedAt: now
    }
}

export function buildWarningBulkOps (items, now = new Date()) {
    const ops = []
    for (const item of items) {
        const doc = mapFogosWarning(item, now)
        if (!doc) continue
        ops.push({
            updateOne: {
                filter: { sourceId: doc.sourceId },
                update: { $set: doc },
                upsert: true
            }
        })
    }
    return ops
}

export async function syncWarnings ({
    fetchJSON = (path) => fetchFogosJSON(FOGOS_V1, path),
    Warning = WarningModel,
    now = new Date()
} = {}) {
    const json = await fetchJSON('/warnings')
    if (!json.success) throw new Error('fogos.pt /warnings returned success=false')

    const ops = buildWarningBulkOps(json.data || [], now)
    await bulkWriteInBatches(Warning, ops)
    return { upserted: ops.length }
}
