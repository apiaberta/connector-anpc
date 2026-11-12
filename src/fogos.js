export const FOGOS_V1 = 'https://api.fogos.pt/v1'
export const FOGOS_V2 = 'https://api.fogos.pt/v2'
export const FOGOS_USER_AGENT = 'apiaberta-connector/1.0 (https://apiaberta.pt)'
export const FOGOS_TIMEOUT_MS = 15_000

export async function fetchFogosJSON (base, path, {
    fetchFn = fetch,
    timeoutMs = FOGOS_TIMEOUT_MS
} = {}) {
    const res = await fetchFn(`${base}${path}`, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'User-Agent': FOGOS_USER_AGENT }
    })
    if (!res.ok) throw new Error(`fogos.pt ${path}: HTTP ${res.status}`)
    return res.json()
}
