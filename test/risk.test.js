import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildRiskBulkOps, mapRiskLocality, resolveDistrict, syncRisk } from '../src/sync/risk.js'
import { mockBulkModel } from './helpers.js'

const localities = {
    '0105': {
        latitude: 40.6,
        longitude: -8.4,
        data: {
            ff_int_id: 3,
            tMax: 24,
            tMin: 12,
            hrMax: 80,
            hrMin: 40,
            ff_dir_id: 'N',
            rr_id: 1,
            rcm: 12
        }
    },
    '1106': {
        latitude: 38.7,
        longitude: -9.1,
        data: { ff_int_id: 2 }
    }
}

describe('resolveDistrict', () => {
    it('maps DICO prefixes including padded short codes', () => {
        assert.equal(resolveDistrict('0105'), 'Aveiro')
        assert.equal(resolveDistrict('1106'), 'Lisboa')
        assert.equal(resolveDistrict('9999'), 'Unknown-9999')
    })
})

describe('mapRiskLocality', () => {
    it('copies forecast fields and resolves the district', () => {
        const now = new Date('2026-11-12T23:00:00.000Z')
        const doc = mapRiskLocality('0105', localities['0105'], '2026-11-12', now)
        assert.equal(doc.district, 'Aveiro')
        assert.equal(doc.level, 3)
        assert.equal(doc.fire_weather_index, 3)
        assert.equal(doc.temperature_max, 24)
        assert.equal(doc.synced_at, now)
    })
})

describe('buildRiskBulkOps', () => {
    it('upserts one op per municipality for the forecast date', () => {
        const ops = buildRiskBulkOps('2026-11-12', localities)
        assert.equal(ops.length, 2)
        const filters = ops.map(op => op.updateOne.filter)
        assert.ok(ops.every(op => op.updateOne.upsert === true))
        assert.ok(filters.some(f => f.dico === '0105' && f.date === '2026-11-12'))
        assert.ok(filters.some(f => f.dico === '1106' && f.date === '2026-11-12'))
    })
})

describe('syncRisk', () => {
    it('bulkWrites today and tomorrow independently', async () => {
        const Risk = mockBulkModel()
        const result = await syncRisk({
            fetchJSON: async (path) => {
                if (path === '/risk-today') {
                    return { success: true, data: { dataPrev: '2026-11-12', local: localities } }
                }
                if (path === '/risk-tomorrow') {
                    return { success: true, data: { dataPrev: '2026-11-13', local: { '0105': localities['0105'] } } }
                }
                throw new Error(path)
            },
            Risk
        })
        assert.deepEqual(result, { today: 2, tomorrow: 1 })
        assert.equal(Risk.writes.length, 2)
        assert.equal(Risk.writes[0].ops.length, 2)
        assert.equal(Risk.writes[1].ops.length, 1)
        assert.equal(Risk.writes[0].options.ordered, false)
    })
})
