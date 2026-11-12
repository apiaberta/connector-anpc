export const WRITE_BATCH_SIZE = 200

export async function bulkWriteInBatches (model, ops, {
    batchSize = WRITE_BATCH_SIZE
} = {}) {
    if (!ops.length) return { batches: 0, operations: 0 }

    let batches = 0
    for (let i = 0; i < ops.length; i += batchSize) {
        const chunk = ops.slice(i, i + batchSize)
        await model.bulkWrite(chunk, { ordered: false })
        batches++
    }
    return { batches, operations: ops.length }
}
