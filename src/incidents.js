import { LATEST_ACTIVE_HINT } from './db/indexes.js'

export { LATEST_ACTIVE_HINT }

export const INCIDENT_LIST_SORT = { datetime: -1 }

export const INCIDENT_PUBLIC_PROJECTION = {
    _id: 0,
    incident_id: 1,
    date: 1,
    datetime: 1,
    natureza: 1,
    natureza_code: 1,
    status: 1,
    status_code: 1,
    active: 1,
    district: 1,
    concelho: 1,
    concerto: 1,
    freguesia: 1,
    location: 1,
    lat: 1,
    lng: 1,
    regiao: 1,
    sub_regiao: 1,
    meios_terra: 1,
    meios_aereos: 1,
    meios_agua: 1
}

export const WARNING_PUBLIC_PROJECTION = {
    _id: 0,
    sourceId: 1,
    text: 1,
    label: 1,
    source: 1
}

export function buildIncidentQuery ({
    active = true,
    district,
    natureza,
    from,
    to
} = {}) {
    const query = {}
    if (active !== undefined) query.active = active
    if (district) query.district = new RegExp(district, 'i')
    if (natureza) query.natureza = new RegExp(natureza, 'i')
    if (from || to) {
        query.datetime = {}
        if (from) query.datetime.$gte = new Date(from)
        if (to) query.datetime.$lte = new Date(to)
    }
    return query
}

export function mapFogosIncident (inc, now = new Date()) {
    return {
        incident_id:   String(inc.id),
        date:          inc.date,
        datetime:      inc.dateTime?.sec ? new Date(inc.dateTime.sec * 1000) : null,
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
        last_seen:     now
    }
}

export function buildIncidentBulkOps (incidents, now = new Date()) {
    const ops = []
    const activeIds = []
    for (const inc of incidents) {
        const doc = mapFogosIncident(inc, now)
        activeIds.push(doc.incident_id)
        ops.push({
            updateOne: {
                filter: { incident_id: doc.incident_id },
                update: { $set: doc },
                upsert: true
            }
        })
    }
    return { ops, activeIds }
}

export function formatIncident (inc) {
    return {
        id:        inc.incident_id,
        date:      inc.date,
        datetime:  inc.datetime,
        type:      inc.natureza,
        type_code: inc.natureza_code,
        status:    inc.status,
        active:    inc.active,
        location: {
            district:  inc.district,
            concerto:  inc.concerto,
            freguesia: inc.freguesia,
            address:   inc.location,
            region:    inc.regiao,
            subregion: inc.sub_regiao,
            lat:       inc.lat,
            lng:       inc.lng
        },
        resources: {
            ground: inc.meios_terra,
            aerial: inc.meios_aereos,
            water:  inc.meios_agua
        }
    }
}

export async function findLatestActiveIncident (Incident) {
    return Incident.findOne({ active: true })
        .select({ datetime: 1, _id: 0 })
        .sort(INCIDENT_LIST_SORT)
        .hint(LATEST_ACTIVE_HINT)
        .limit(1)
        .lean()
}
