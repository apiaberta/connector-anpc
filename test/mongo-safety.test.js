import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
    DEFAULT_MONGO_URI,
    assertSafeMongoTarget,
    isLocalMongoUri,
    mongoHostname
} from '../src/db/mongoUri.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('mongo URI safety', () => {
    it('defaults to localhost apiaberta-anpc', () => {
        assert.equal(DEFAULT_MONGO_URI, 'mongodb://localhost:27017/apiaberta-anpc')
        assert.equal(mongoHostname(DEFAULT_MONGO_URI), 'localhost')
        assert.equal(isLocalMongoUri(DEFAULT_MONGO_URI), true)
        assert.equal(isLocalMongoUri('mongodb://127.0.0.1:27017/apiaberta-anpc-test'), true)
        assert.equal(isLocalMongoUri('mongodb://mongo.internal:27017/apiaberta-anpc'), false)
    })

    it('matches .env.example to the local default', () => {
        const envExample = readFileSync(join(root, '.env.example'), 'utf8')
        assert.match(envExample, /MONGO_URI=mongodb:\/\/localhost:27017\/apiaberta-anpc/)
        assert.doesNotMatch(envExample, /mongodb\+srv:/)
    })

    it('refuses to connect under NODE_ENV=test', () => {
        assert.throws(
            () => assertSafeMongoTarget(DEFAULT_MONGO_URI, 'test'),
            /must not connect to MongoDB under NODE_ENV=test/
        )
    })

    it('refuses a remote host in development', () => {
        assert.throws(
            () => assertSafeMongoTarget('mongodb://db.example.net:27017/apiaberta-anpc', 'development'),
            /non-local MongoDB host "db.example.net"/
        )
    })

    it('allows a remote host only in production', () => {
        const uri = 'mongodb://db.example.net:27017/apiaberta-anpc'
        assert.equal(assertSafeMongoTarget(uri, 'production'), uri)
        assert.equal(assertSafeMongoTarget(DEFAULT_MONGO_URI, 'development'), DEFAULT_MONGO_URI)
    })

    it('calls assertSafeMongoTarget before mongoose.connect in src/index.js', () => {
        const src = readFileSync(join(root, 'src/index.js'), 'utf8')
        const safety = src.indexOf('assertSafeMongoTarget(MONGO_URI)')
        const connect = src.indexOf('mongoose.connect(MONGO_URI)')
        const autoIndex = src.indexOf("mongoose.set('autoIndex', false)")
        assert.ok(safety >= 0)
        assert.ok(connect > safety)
        assert.ok(autoIndex >= 0)
        assert.ok(autoIndex < connect)
        assert.match(src, /ensureIndexes\(\)/)
    })

    it('does not import src/index.js from tests (would start cron and listen)', () => {
        const here = dirname(fileURLToPath(import.meta.url))
        const names = ['indexes', 'incidents', 'connector', 'warnings', 'risk', 'bulk', 'mongo-safety', 'fogos']
        for (const name of names) {
            const src = readFileSync(join(here, `${name}.test.js`), 'utf8')
            assert.doesNotMatch(src, /from '\.\.\/src\/index\.js'/)
            assert.doesNotMatch(src, /from ['"]mongoose['"]/)
        }
    })
})
