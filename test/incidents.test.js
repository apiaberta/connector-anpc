import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
    INCIDENT_LIST_SORT,
    INCIDENT_PUBLIC_PROJECTION,
    LATEST_ACTIVE_HINT,
    WARNING_PUBLIC_PROJECTION,
    buildIncidentBulkOps,
    buildIncidentQuery,
    findLatestActiveIncident,
    formatIncident,
    mapFogosIncident
} from '../src/incidents.js'

const fixtures = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures/incidents-active.json'), 'utf8')
)

describe('buildIncidentQuery', () => {
    it('defaults to active=true so the compound {active, datetime} prefix applies', () => {
        assert.deepEqual(buildIncidentQuery(), { active: true })
    })

    it('adds a datetime range and keeps active for ESR (equality, sort, range)', () => {
        const query = buildIncidentQuery({
            from: '2026-11-01T00:00:00.000Z',
            to: '2026-11-12T00:00:00.000Z'
        })
        assert.equal(query.active, true)
        assert.equal(query.datetime.$gte.toISOString(), '2026-11-01T00:00:00.000Z')
        assert.equal(query.datetime.$lte.toISOString(), '2026-11-12T00:00:00.000Z')
    })

    it('filters district and natureza case-insensitively', () => {
        const query = buildIncidentQuery({ district: 'Porto', natureza: 'Mato', active: false })
        assert.equal(query.active, false)
        assert.equal(query.district.ignoreCase, true)
        assert.equal(query.natureza.ignoreCase, true)
        assert.ok(query.district.test('porto'))
        assert.ok(query.natureza.test('mato'))
    })
})

describe('mapFogosIncident', () => {
    it('maps dateTime.sec to a Date and sums aerial resources', () => {
        const now = new Date('2026-11-12T23:00:00.000Z')
        const first = mapFogosIncident(fixtures.data[0], now)
        assert.equal(first.incident_id, '101')
        assert.equal(first.datetime.toISOString(), '2026-11-12T22:00:00.000Z')
        assert.equal(first.meios_aereos, 1)
        assert.equal(first.last_seen, now)
        assert.equal(first.active, true)
        assert.equal(first.location, 'Rio Tinto')
    })

    it('defaults active to true and uses localidade as location fallback', () => {
        const second = mapFogosIncident(fixtures.data[1], new Date())
        assert.equal(second.incident_id, '202')
        assert.equal(second.active, true)
        assert.equal(second.location, 'Aguada de Cima')
        assert.equal(second.meios_aereos, 2)
        assert.equal(second.meios_agua, 2)
    })
})

describe('buildIncidentBulkOps', () => {
    it('builds one upsert per incident and lists active ids', () => {
        const now = new Date('2026-11-12T23:00:00.000Z')
        const { ops, activeIds } = buildIncidentBulkOps(fixtures.data, now)
        assert.deepEqual(activeIds, ['101', '202'])
        assert.equal(ops.length, 2)
        assert.equal(ops[0].updateOne.filter.incident_id, '101')
        assert.equal(ops[0].updateOne.upsert, true)
        assert.equal(ops[0].updateOne.update.$set.last_seen, now)
        assert.equal(ops[1].updateOne.filter.incident_id, '202')
    })
})

describe('formatIncident', () => {
    it('keeps the public incident response shape', () => {
        const formatted = formatIncident({
            incident_id: '101',
            date: '2026-11-12',
            datetime: new Date('2026-11-12T22:00:00.000Z'),
            natureza: 'Mato',
            natureza_code: '3101',
            status: 'Em Curso',
            active: true,
            district: 'Porto',
            concerto: undefined,
            freguesia: 'Rio Tinto',
            location: 'Rio Tinto',
            regiao: 'Norte',
            sub_regiao: 'AMP',
            lat: 41.18,
            lng: -8.56,
            meios_terra: 12,
            meios_aereos: 1,
            meios_agua: 0
        })
        assert.deepEqual(formatted, {
            id: '101',
            date: '2026-11-12',
            datetime: new Date('2026-11-12T22:00:00.000Z'),
            type: 'Mato',
            type_code: '3101',
            status: 'Em Curso',
            active: true,
            location: {
                district: 'Porto',
                concerto: undefined,
                freguesia: 'Rio Tinto',
                address: 'Rio Tinto',
                region: 'Norte',
                subregion: 'AMP',
                lat: 41.18,
                lng: -8.56
            },
            resources: { ground: 12, aerial: 1, water: 0 }
        })
    })
})

describe('findLatestActiveIncident', () => {
    it('filters active, sorts datetime desc, hints the compound index, projects datetime, limits 1', async () => {
        const calls = {}
        const chain = {
            select (p) { calls.select = p; return chain },
            sort (s) { calls.sort = s; return chain },
            hint (h) { calls.hint = h; return chain },
            limit (n) { calls.limit = n; return chain },
            lean () { return Promise.resolve({ datetime: new Date('2026-11-12T22:00:00.000Z') }) }
        }
        const Incident = {
            findOne (q) { calls.query = q; return chain }
        }
        const latest = await findLatestActiveIncident(Incident)
        assert.deepEqual(calls.query, { active: true })
        assert.deepEqual(calls.sort, INCIDENT_LIST_SORT)
        assert.deepEqual(calls.hint, LATEST_ACTIVE_HINT)
        assert.equal(calls.limit, 1)
        assert.equal(calls.select.datetime, 1)
        assert.equal(latest.datetime.toISOString(), '2026-11-12T22:00:00.000Z')
    })
})

describe('projections', () => {
    it('omits last_seen and _id from public incident reads', () => {
        assert.equal(INCIDENT_PUBLIC_PROJECTION._id, 0)
        assert.equal(INCIDENT_PUBLIC_PROJECTION.last_seen, undefined)
        assert.equal(INCIDENT_PUBLIC_PROJECTION.incident_id, 1)
        assert.equal(INCIDENT_PUBLIC_PROJECTION.datetime, 1)
        assert.equal(WARNING_PUBLIC_PROJECTION.sourceId, 1)
        assert.equal(WARNING_PUBLIC_PROJECTION._id, 0)
        assert.equal(WARNING_PUBLIC_PROJECTION.syncedAt, undefined)
    })
})
