import Fastify from 'fastify'
import mongoose from 'mongoose'
import cron from 'node-cron'
import { dataRoutes } from './routes/data.js'
import { fetchActiveIncidents } from './connector.js'
import { syncRisk } from './sync/risk.js'
import { syncWarnings } from './sync/warnings.js'
import { Incident } from './db/models.js'
import { ensureIndexes } from './db/indexes.js'
import { assertSafeMongoTarget, DEFAULT_MONGO_URI } from './db/mongoUri.js'
import { findLatestActiveIncident, LATEST_ACTIVE_HINT } from './incidents.js'
import { SERVICE_NAME, SERVICE_VERSION } from './version.js'

mongoose.set('autoIndex', false)

const app = Fastify({
    logger: {
        transport: process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty' }
            : undefined
    }
})

const PORT      = parseInt(process.env.PORT || '3006')
const MONGO_URI = process.env.MONGO_URI || DEFAULT_MONGO_URI

async function incidentMetaPayload () {
    const [latest, active, total] = await Promise.all([
        findLatestActiveIncident(Incident),
        Incident.countDocuments({ active: true }).hint(LATEST_ACTIVE_HINT),
        Incident.countDocuments()
    ])

    return {
        service:          SERVICE_NAME,
        version:          SERVICE_VERSION,
        source:           'https://api.fogos.pt (ANEPC / ICNF)',
        description:      'Civil protection incidents in Portugal (fires, floods, rescue operations)',
        active_incidents: active,
        total_incidents:  total,
        last_incident:    latest?.datetime || null,
        update_frequency: {
            incidents: 'every 5 minutes',
            risk:      'every 6 hours',
            warnings:  'every 5 minutes'
        }
    }
}

app.get('/health', async () => ({
    status:    'ok',
    service:   SERVICE_NAME,
    version:   SERVICE_VERSION,
    timestamp: new Date().toISOString()
}))

app.get('/meta', async () => incidentMetaPayload())
app.get('/anpc/meta', async () => incidentMetaPayload())

await app.register(dataRoutes)

assertSafeMongoTarget(MONGO_URI)
await mongoose.connect(MONGO_URI)
app.log.info('Connected to MongoDB')

const indexResult = await ensureIndexes()
app.log.info({ indexes: indexResult.length }, 'MongoDB indexes ensured')

cron.schedule('*/5 * * * *', async () => {
    try {
        const result = await fetchActiveIncidents()
        if (result.upserted > 0 || result.deactivated > 0) {
            app.log.info({ result }, 'Incidents updated')
        }
    } catch (err) {
        app.log.error({ err }, 'Incident fetch failed')
    }
})

cron.schedule('0 */6 * * *', async () => {
    try {
        const result = await syncRisk()
        app.log.info({ result }, 'Risk data synced')
    } catch (err) {
        app.log.error({ err }, 'Risk sync failed')
    }
})

cron.schedule('*/5 * * * *', async () => {
    try {
        const result = await syncWarnings()
        if (result.upserted > 0) {
            app.log.info({ result }, 'Warnings synced')
        }
    } catch (err) {
        app.log.error({ err }, 'Warning sync failed')
    }
})

app.log.info('Running initial data fetches...')
Promise.all([
    fetchActiveIncidents().then(r => app.log.info({ result: r }, 'Initial incidents fetch complete')),
    syncRisk().then(r => app.log.info({ result: r }, 'Initial risk sync complete')),
    syncWarnings().then(r => app.log.info({ result: r }, 'Initial warnings sync complete'))
]).catch(err => app.log.error({ err }, 'Initial fetch failed'))

await app.listen({ port: PORT, host: '0.0.0.0' })
