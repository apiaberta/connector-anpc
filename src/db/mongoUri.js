const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

export const DEFAULT_MONGO_URI = 'mongodb://localhost:27017/apiaberta-anpc'

export function mongoHostname (uri) {
    try {
        return new URL(uri).hostname
    } catch {
        return ''
    }
}

export function isLocalMongoUri (uri) {
    if (!uri) return true
    const host = mongoHostname(uri)
    return LOCAL_HOSTS.has(host)
}

/**
 * Tests and local/dev runs must not open a production MongoDB.
 * Production (NODE_ENV=production) is unrestricted.
 */
export function assertSafeMongoTarget (uri, env = process.env.NODE_ENV) {
    if (env === 'production') return uri
    if (env === 'test') {
        throw new Error('connector-anpc must not connect to MongoDB under NODE_ENV=test')
    }
    if (!isLocalMongoUri(uri)) {
        const host = mongoHostname(uri)
        throw new Error(
            `Refusing to connect to non-local MongoDB host "${host}" when NODE_ENV=${env || 'development'}`
        )
    }
    return uri
}
