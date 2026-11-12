import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchActiveIncidents } from '../src/connector.js'
import { WRITE_BATCH_SIZE } from '../src/db/bulk.js'
import { mockBulkModel } from './helpers.js'

const fixtures = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures/incidents-active.json'), 'utf8')
)

describe('fetchActiveIncidents', () => {
    it('bulkWrites mapped incidents and deactivates ids missing from the feed', async () => {
        const Incident = mockBulkModel()
        const now = new Date('2026-11-12T23:00:00.000Z')
        const result = await fetchActiveIncidents({
            fetchJSON: async (path) => {
                assert.equal(path, '/incidents/active')
                return fixtures
            },
            Incident,
            now
        })

        assert.deepEqual(result, { upserted: 2, deactivated: 1 })
        assert.equal(Incident.writes.length, 1)
        assert.equal(Incident.writes[0].options.ordered, false)
        assert.equal(Incident.writes[0].ops.length, 2)
        assert.equal(Incident.writes[0].ops[0].updateOne.update.$set.incident_id, '101')
        assert.deepEqual(Incident.updates[0].filter, {
            active: true,
            incident_id: { $nin: ['101', '202'] }
        })
        assert.deepEqual(Incident.updates[0].update, { $set: { active: false } })
    })

    it('skips bulkWrite on an empty feed but still deactivates leftovers', async () => {
        const Incident = mockBulkModel()
        const result = await fetchActiveIncidents({
            fetchJSON: async () => ({ success: true, data: [] }),
            Incident
        })
        assert.deepEqual(result, { upserted: 0, deactivated: 0 })
        assert.equal(Incident.writes.length, 0)
        assert.deepEqual(Incident.updates[0].filter.incident_id.$nin, [])
    })

    it('throws when fogos.pt reports success=false', async () => {
        await assert.rejects(
            () => fetchActiveIncidents({
                fetchJSON: async () => ({ success: false }),
                Incident: mockBulkModel()
            }),
            /success=false/
        )
    })

    it('keeps write batches small enough for the 3.7 GiB host', () => {
        assert.equal(WRITE_BATCH_SIZE, 200)
        assert.ok(WRITE_BATCH_SIZE <= 500)
    })
})
