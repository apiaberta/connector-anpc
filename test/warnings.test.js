import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildWarningBulkOps, mapFogosWarning, syncWarnings } from '../src/sync/warnings.js'
import { mockBulkModel } from './helpers.js'

const fixtures = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures/warnings.json'), 'utf8')
)

describe('mapFogosWarning', () => {
    it('reads Mongo extended JSON _id.$id and string _id', () => {
        const now = new Date('2026-11-12T23:00:00.000Z')
        assert.deepEqual(mapFogosWarning(fixtures.data[0], now), {
            sourceId: 'warn-1',
            text: 'Corte na EN109',
            label: 'via-cortada',
            source: 'fogos.pt',
            syncedAt: now
        })
        assert.equal(mapFogosWarning(fixtures.data[1], now).sourceId, 'warn-2')
        assert.equal(mapFogosWarning(fixtures.data[2], now), null)
        assert.equal(mapFogosWarning({ text: 'no id' }, now), null)
    })
})

describe('buildWarningBulkOps', () => {
    it('skips items without a sourceId', () => {
        const ops = buildWarningBulkOps(fixtures.data)
        assert.equal(ops.length, 2)
        assert.equal(ops[0].updateOne.filter.sourceId, 'warn-1')
        assert.equal(ops[0].updateOne.upsert, true)
        assert.equal(ops[1].updateOne.filter.sourceId, 'warn-2')
    })
})

describe('syncWarnings', () => {
    it('bulkWrites warnings in one unordered batch', async () => {
        const Warning = mockBulkModel()
        const now = new Date('2026-11-12T23:00:00.000Z')
        const result = await syncWarnings({
            fetchJSON: async (path) => {
                assert.equal(path, '/warnings')
                return fixtures
            },
            Warning,
            now
        })
        assert.deepEqual(result, { upserted: 2 })
        assert.equal(Warning.writes.length, 1)
        assert.equal(Warning.writes[0].options.ordered, false)
        assert.equal(Warning.writes[0].ops[0].updateOne.update.$set.syncedAt, now)
    })

    it('throws when fogos.pt reports success=false', async () => {
        await assert.rejects(
            () => syncWarnings({
                fetchJSON: async () => ({ success: false }),
                Warning: mockBulkModel()
            }),
            /success=false/
        )
    })
})
