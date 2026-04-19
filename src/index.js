import Fastify from 'fastify'
import mongoose from 'mongoose'
import cron from 'node-cron'
import { dataRoutes } from './routes/data.js'
import { fetchActiveIncidents } from './connector.js'
import { syncRisk } from './sync/risk.js'
import { syncWarnings } from './sync/warnings.js'
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
  version:   '1.1.0',
  timestamp: new Date().toISOString()
}))

app.get('/meta', async () => {
  const latest  = await Incident.findOne({ active: true }).sort({ datetime: -1 }).lean()
  const active  = await Incident.countDocuments({ active: true })
  const total   = await Incident.countDocuments()

  return {
    service:          SERVICE_NAME,
    version:          '1.1.0',
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
})

app.get('/anpc/meta', async () => {
  const latest  = await Incident.findOne({ active: true }).sort({ datetime: -1 }).lean()
  const active  = await Incident.countDocuments({ active: true })
  const total   = await Incident.countDocuments()

  return {
    service:          SERVICE_NAME,
    version:          '1.1.0',
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
})

// ─── Data routes ─────────────────────────────────────────────────────────────

await app.register(dataRoutes)

// ─── Cron: poll incidents every 5 minutes ───────────────────────────────────

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

// ─── Cron: sync fire risk every 6 hours ──────────────────────────────────────

cron.schedule('0 */6 * * *', async () => {
  try {
    const result = await syncRisk()
    app.log.info({ result }, 'Risk data synced')
  } catch (err) {
    app.log.error({ err }, 'Risk sync failed')
  }
})

// ─── Cron: sync warnings every 5 minutes ─────────────────────────────────────

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

// ─── Startup ─────────────────────────────────────────────────────────────────

await mongoose.connect(MONGO_URI)
app.log.info('Connected to MongoDB')

// Initial fetches
app.log.info('Running initial data fetches...')

Promise.all([
  fetchActiveIncidents().then(r => app.log.info({ result: r }, 'Initial incidents fetch complete')),
  syncRisk().then(r => app.log.info({ result: r }, 'Initial risk sync complete')),
  syncWarnings().then(r => app.log.info({ result: r }, 'Initial warnings sync complete'))
]).catch(err => app.log.error({ err }, 'Initial fetch failed'))

await app.listen({ port: PORT, host: '0.0.0.0' })
