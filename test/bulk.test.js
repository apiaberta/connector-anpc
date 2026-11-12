import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { WRITE_BATCH_SIZE, bulkWriteInBatches } from '../src/db/bulk.js'

describe('bulkWriteInBatches', () => {
    it('does not call bulkWrite for an empty ops list', async () => {
        const model = { async bulkWrite () { throw new Error('should not write') } }
        const result = await bulkWriteInBatches(model, [])
        assert.deepEqual(result, { batches: 0, operations: 0 })
    })

    it('splits ops into unordered chunks of WRITE_BATCH_SIZE', async () => {
        const writes = []
        const model = {
            async bulkWrite (ops, options) {
                writes.push({ ops, options })
            }
        }
        const ops = Array.from({ length: WRITE_BATCH_SIZE + 3 }, (_, i) => ({
            updateOne: { filter: { id: i }, update: { $set: { id: i } }, upsert: true }
        }))
        const result = await bulkWriteInBatches(model, ops)
        assert.deepEqual(result, { batches: 2, operations: WRITE_BATCH_SIZE + 3 })
        assert.equal(writes[0].ops.length, WRITE_BATCH_SIZE)
        assert.equal(writes[1].ops.length, 3)
        assert.equal(writes[0].options.ordered, false)
        assert.equal(writes[1].options.ordered, false)
    })
})
