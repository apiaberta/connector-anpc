import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { FOGOS_TIMEOUT_MS, FOGOS_V1, FOGOS_V2, fetchFogosJSON } from '../src/fogos.js'

describe('fetchFogosJSON', () => {
    it('calls the given base+path with the connector user-agent', async () => {
        const calls = []
        const fetchFn = async (url, opts) => {
            calls.push({ url, opts })
            return {
                ok: true,
                async json () { return { success: true } }
            }
        }
        const json = await fetchFogosJSON(FOGOS_V2, '/incidents/active', { fetchFn })
        assert.deepEqual(json, { success: true })
        assert.equal(calls[0].url, `${FOGOS_V2}/incidents/active`)
        assert.equal(calls[0].opts.headers['User-Agent'], 'apiaberta-connector/1.0 (https://apiaberta.pt)')
        assert.ok(calls[0].opts.signal)
        assert.equal(FOGOS_TIMEOUT_MS, 15_000)
        assert.equal(FOGOS_V1, 'https://api.fogos.pt/v1')
    })

    it('throws a fogos.pt HTTP error on non-OK responses', async () => {
        await assert.rejects(
            () => fetchFogosJSON(FOGOS_V1, '/warnings', {
                fetchFn: async () => ({ ok: false, status: 502 })
            }),
            /fogos\.pt \/warnings: HTTP 502/
        )
    })
})
