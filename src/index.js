import Fastify from 'fastify'
import mongoose from 'mongoose'
import cron from 'node-cron'
import { dataRoutes } from './routes/data.js'
import { fetchActiveIncidents } from './connector.js'
import { Incident } from './db/models.js'

const app = Fastify({
  logger: {
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty' }
      : undefined
  }
})

const SERVICE_NAME = 'connector-anpc'
const PORT      = parseInt(process.env.PORT || '3006')
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/apiaberta-anpc'

// ─── Required endpoints ──────────────────────────────────────────────────────

app.get('/health', async () => ({
  status:    'ok',
  service:   SERVICE_NAME,
  version:   '1.0.0',
  timestamp: new Date().toISOString()
}))

app.get('/meta', async () => {
  const latest  = await Incident.findOne({ active: true }).sort({ datetime: -1 }).lean()
  const active  = await Incident.countDocuments({ active: true })
  const total   = await Incident.countDocuments()

  return {
    service:          SERVICE_NAME,
    source:           'https://api.fogos.pt (ANEPC / ICNF)',
    description:      'Civil protection incidents in Portugal (fires, floods, rescue operations)',
    active_incidents: active,
    total_incidents:  total,
    last_incident:    latest?.datetime || null,
    update_frequency: 'every 5 minutes'
  }
})

// ─── Data routes ─────────────────────────────────────────────────────────────

await app.register(dataRoutes)

// ─── Cron: poll every 5 minutes ──────────────────────────────────────────────

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

// ─── Startup ─────────────────────────────────────────────────────────────────

await mongoose.connect(MONGO_URI)
app.log.info('Connected to MongoDB')

// Initial fetch
app.log.info('Running initial incident fetch...')
fetchActiveIncidents()
  .then(r => app.log.info({ result: r }, 'Initial fetch complete'))
  .catch(err => app.log.error({ err }, 'Initial fetch failed'))

await app.listen({ port: PORT, host: '0.0.0.0' })
