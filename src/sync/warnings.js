/**
 * sync/warnings.js — syncs road/traffic warnings from fogos.pt
 * Endpoint: /v1/warnings
 * Returns road-cut and emergency notices from ANEPC/VOST
 */

import { Warning } from '../db/models.js'

const FOGOS_API = 'https://api.fogos.pt/v1'

async function fetchJSON (path) {
  const res = await fetch(`${FOGOS_API}${path}`, {
    signal: AbortSignal.timeout(15000),
    headers: { 'User-Agent': 'apiaberta-connector/1.0 (https://apiaberta.pt)' }
  })
  if (!res.ok) throw new Error(`fogos.pt ${path}: HTTP ${res.status}`)
  return res.json()
}

export async function syncWarnings () {
  const json = await fetchJSON('/warnings')
  if (!json.success) throw new Error('fogos.pt /warnings returned success=false')

  const items = json.data || []
  let upserted = 0

  for (const item of items) {
    const sourceId = item._id?.$id ?? item._id ?? null

    await Warning.findOneAndUpdate(
      { sourceId },
      {
        sourceId,
        text:     item.text ?? '',
        label:    item.label ?? '',
        source:   'fogos.pt',
        syncedAt: new Date()
      },
      { upsert: true }
    )
    upserted++
  }

  return { upserted }
}
