import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { INDEXES, LATEST_ACTIVE_HINT, allIndexSpecs, ensureIndexes } from '../src/db/indexes.js'
import { mockCollection, mockModel } from './helpers.js'

describe('INDEXES', () => {
    it('declares the compound index that covers find({active:true}).sort({datetime:-1})', () => {
        const spec = INDEXES.incidents.find(i => i.options.name === 'active_1_datetime_-1')
        assert.deepEqual(spec.keys, { active: 1, datetime: -1 })
        assert.deepEqual(LATEST_ACTIVE_HINT, spec.keys)
        assert.equal(spec.options.unique, undefined)
    })

    it('keeps unique incident_id and warning sourceId', () => {
        assert.equal(
            INDEXES.incidents.find(i => i.options.name === 'incident_id_1').options.unique,
            true
        )
        assert.equal(
            INDEXES.warnings.find(i => i.options.name === 'sourceId_1').options.unique,
            true
        )
        assert.deepEqual(
            INDEXES.warnings.find(i => i.options.name === 'syncedAt_-1').keys,
            { syncedAt: -1 }
        )
    })

    it('covers risk queries by date then district/dico', () => {
        const spec = INDEXES.risks.find(i => i.options.name === 'date_1_district_1_dico_1')
        assert.deepEqual(spec.keys, { date: 1, district: 1, dico: 1 })
    })

    it('names every spec so createIndex is addressable and documented', () => {
        for (const spec of allIndexSpecs()) {
            assert.ok(spec.options.name, spec.purpose)
            assert.ok(spec.purpose.length > 8)
            assert.ok(Object.keys(spec.keys).length >= 1)
        }
    })
})

describe('ensureIndexes', () => {
    it('creates every declared index and is idempotent on a second call', async () => {
        const incidents = mockCollection()
        const warnings = mockCollection()
        const risks = mockCollection()
        const models = {
            incidents: mockModel(incidents),
            warnings: mockModel(warnings),
            risks: mockModel(risks)
        }

        const first = await ensureIndexes(models)
        const second = await ensureIndexes(models)

        assert.equal(first.length, allIndexSpecs().length)
        assert.equal(second.length, first.length)
        assert.equal(incidents.calls.length, INDEXES.incidents.length * 2)
        assert.deepEqual(incidents.calls[0].keys, incidents.calls[INDEXES.incidents.length].keys)
        assert.deepEqual(incidents.calls[0].options, incidents.calls[INDEXES.incidents.length].options)
    })

    it('passes unique and name through to createIndex', async () => {
        const incidents = mockCollection()
        await ensureIndexes({
            incidents: mockModel(incidents),
            warnings: mockModel(mockCollection()),
            risks: mockModel(mockCollection())
        })
        const unique = incidents.calls.find(c => c.options.name === 'incident_id_1')
        assert.equal(unique.options.unique, true)
        const compound = incidents.calls.find(c => c.options.name === 'active_1_datetime_-1')
        assert.deepEqual(compound.keys, { active: 1, datetime: -1 })
    })
})
