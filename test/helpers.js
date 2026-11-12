export function mockCollection () {
    const calls = []
    const byName = new Map()
    return {
        calls,
        async createIndex (keys, options = {}) {
            const name = options.name || Object.entries(keys).map(([k, v]) => `${k}_${v}`).join('_')
            const spec = JSON.stringify({ keys, options: { ...options, name } })
            const prev = byName.get(name)
            if (prev && prev !== spec) {
                throw new Error(`Index ${name} already exists with different options`)
            }
            byName.set(name, spec)
            calls.push({ keys, options: { ...options, name } })
            return name
        }
    }
}

export function mockModel (collection) {
    return { collection }
}

export function mockBulkModel () {
    const writes = []
    const updates = []
    return {
        writes,
        updates,
        async bulkWrite (ops, options) {
            writes.push({ ops, options })
            return { ok: 1, n: ops.length }
        },
        async updateMany (filter, update) {
            updates.push({ filter, update })
            return { modifiedCount: filter.incident_id?.$nin?.length ? 1 : 0 }
        }
    }
}
