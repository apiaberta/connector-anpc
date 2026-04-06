import { Incident, Risk, Warning } from '../db/models.js'

export async function dataRoutes (app) {

  // GET /v1/anpc/incidents — list incidents with filters
  app.get('/anpc/incidents', {
    schema: {
      description: 'List civil protection incidents in Portugal (from ANEPC via fogos.pt)',
      tags: ['ANPC / Proteção Civil'],
      querystring: {
        type: 'object',
        properties: {
          active:   { type: 'boolean', description: 'Filter by active status (default: true)' },
          district: { type: 'string',  description: 'Filter by district name (case-insensitive)' },
          natureza: { type: 'string',  description: 'Filter by incident type (e.g. Mato, Florestal)' },
          from:     { type: 'string',  description: 'ISO date filter (from)' },
          to:       { type: 'string',  description: 'ISO date filter (to)' },
          page:     { type: 'integer', default: 1,  minimum: 1 },
          limit:    { type: 'integer', default: 20, maximum: 100 }
        }
      }
    }
  }, async (req, reply) => {
    const { active = true, district, natureza, from, to, page = 1, limit = 20 } = req.query

    const query = {}
    if (active !== undefined) query.active = active
    if (district) query.district = new RegExp(district, 'i')
    if (natureza) query.natureza = new RegExp(natureza, 'i')
    if (from || to) {
      query.datetime = {}
      if (from) query.datetime.$gte = new Date(from)
      if (to)   query.datetime.$lte = new Date(to)
    }

    const skip = (page - 1) * limit
    const [incidents, total] = await Promise.all([
      Incident.find(query).sort({ datetime: -1 }).skip(skip).limit(limit).lean(),
      Incident.countDocuments(query)
    ])

    return {
      meta:  { page, limit, total, pages: Math.ceil(total / limit) },
      data:  incidents.map(formatIncident)
    }
  })

  // GET /v1/anpc/incidents/active — shortcut: active incidents only
  app.get('/anpc/incidents/active', {
    schema: {
      description: 'Active civil protection incidents in Portugal right now',
      tags: ['ANPC / Proteção Civil']
    }
  }, async () => {
    const incidents = await Incident.find({ active: true }).sort({ datetime: -1 }).lean()
    return {
      count: incidents.length,
      as_of: new Date().toISOString(),
      data:  incidents.map(formatIncident)
    }
  })

  // GET /v1/anpc/summary — incident counts by district
  app.get('/anpc/summary', {
    schema: {
      description: 'Summary of active civil protection incidents by district',
      tags: ['ANPC / Proteção Civil']
    }
  }, async () => {
    const byDistrict = await Incident.aggregate([
      { $match: { active: true } },
      {
        $group: {
          _id:    '$district',
          count:  { $sum: 1 },
          types:  { $addToSet: '$natureza' }
        }
      },
      { $sort: { count: -1 } }
    ])

    const byNatureza = await Incident.aggregate([
      { $match: { active: true } },
      { $group: { _id: '$natureza', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ])

    const total = await Incident.countDocuments({ active: true })

    return {
      total_active: total,
      as_of:         new Date().toISOString(),
      by_district:   byDistrict.map(d => ({ district: d._id, count: d.count })),
      by_type:       byNatureza.map(d => ({ type: d._id, count: d.count }))
    }
  })

  // ─── Fire Risk ──────────────────────────────────────────────────────────────

  // GET /v1/anpc/risk — fire risk by district, optionally filtered by date
  app.get('/anpc/risk', {
    schema: {
      description: 'Fire risk index per district/municipality (synced from fogos.pt, every 6h)',
      tags: ['ANPC / Proteção Civil'],
      querystring: {
        type: 'object',
        properties: {
          date:     { type: 'string', description: 'today | tomorrow (default: today)' },
          district: { type: 'string', description: 'Filter by district name (case-insensitive)' }
        }
      }
    }
  }, async (req) => {
    const { date = 'today', district } = req.query

    const targetDate = date === 'tomorrow'
      ? getTomorrowDate()
      : getTodayDate()

    const query = { date: targetDate }
    if (district) query.district = new RegExp(district, 'i')

    const risks = await Risk.find(query).sort({ district: 1, dico: 1 }).lean()

    return {
      date,
      target_date: targetDate,
      count: risks.length,
      as_of: new Date().toISOString(),
      data: risks.map(r => ({
        dico:           r.dico,
        district:       r.district,
        level:          r.level,           // 1=green, 2=blue, 3=yellow, 4=orange, 5=red
        fire_weather_index: r.fire_weather_index,
        temperature: { min: r.temperature_min, max: r.temperature_max },
        humidity:    { min: r.humidity_min,    max: r.humidity_max },
        wind:        { direction: r.wind_direction },
        precipitation_risk: r.precipitation_risk,
        rcm:         r.rcm,
        location:    { lat: r.latitude, lng: r.longitude }
      }))
    }
  })

  // GET /v1/anpc/risk/:district — fire risk for a specific district
  app.get('/anpc/risk/:district', {
    schema: {
      description: 'Fire risk forecast for a specific district',
      tags: ['ANPC / Proteção Civil'],
      params: {
        type: 'object',
        properties: {
          district: { type: 'string', description: 'District name (e.g. Aveiro, Coimbra)' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'today | tomorrow (default: today)' }
        }
      }
    }
  }, async (req) => {
    const { district } = req.params
    const { date = 'today' } = req.query

    const targetDate = date === 'tomorrow' ? getTomorrowDate() : getTodayDate()

    const risks = await Risk.find({
      date:    targetDate,
      district: new RegExp(district, 'i')
    }).sort({ dico: 1 }).lean()

    if (risks.length === 0) {
      return reply.code(404).send({ error: `No risk data found for district "${district}" on ${targetDate}` })
    }

    return {
      district: risks[0].district,
      date,
      target_date: targetDate,
      count: risks.length,
      as_of: new Date().toISOString(),
      level_summary: summariseLevel(risks),
      data: risks.map(r => ({
        dico:     r.dico,
        level:    r.level,
        fire_weather_index: r.fire_weather_index,
        temperature: { min: r.temperature_min, max: r.temperature_max },
        humidity:    { min: r.humidity_min,    max: r.humidity_max },
        wind:        { direction: r.wind_direction },
        rcm:         r.rcm,
        location:    { lat: r.latitude, lng: r.longitude }
      }))
    }
  })

  // ─── Warnings ────────────────────────────────────────────────────────────────

  // GET /v1/anpc/warnings — road/traffic warnings from ANEPC/fogos.pt
  app.get('/anpc/warnings', {
    schema: {
      description: 'Road cuts and traffic warnings from ANEPC (synced every 5 min)',
      tags: ['ANPC / Proteção Civil'],
      querystring: {
        type: 'object',
        properties: {
          page:  { type: 'integer', default: 1, minimum: 1 },
          limit: { type: 'integer', default: 50, maximum: 200 }
        }
      }
    }
  }, async (req) => {
    const { page = 1, limit = 50 } = req.query
    const skip = (page - 1) * limit

    const [warnings, total] = await Promise.all([
      Warning.find().sort({ syncedAt: -1 }).skip(skip).limit(limit).lean(),
      Warning.countDocuments()
    ])

    return {
      meta:  { page, limit, total, pages: Math.ceil(total / limit) },
      data:  warnings.map(w => ({
        id:    w.sourceId,
        text:  w.text,
        label: w.label,
        source: w.source
      }))
    }
  })

  // ─── Hotspots (proxy to fogos.pt) ───────────────────────────────────────────

  // GET /v1/anpc/hotspots — satellite-detected fire hotspots (VIIRS/MODIS)
  // Note: /v1/hotspots is Cloudflare-protected; /v2/hotspots attempted
  app.get('/anpc/hotspots', {
    schema: {
      description: 'Satellite-detected fire hotspots (VIIRS/MODIS) — proxied from fogos.pt',
      tags: ['ANPC / Proteção Civil']
    }
  }, async (req, reply) => {
    const res = await fetch('https://api.fogos.pt/v1/hotspots', {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'apiaberta-connector/1.0 (https://apiaberta.pt)' }
    })

    if (!res.ok) {
      app.log.warn({ status: res.status }, 'fogos.pt /hotspots unavailable (Cloudflare blocked)')
      return reply.code(502).send({
        error: 'Hotspots endpoint currently unavailable (Cloudflare protection on source)',
        source: 'https://api.fogos.pt/v1/hotspots',
        status: res.status
      })
    }

    const json = await res.json()
    return {
      source: 'fogos.pt',
      as_of:  new Date().toISOString(),
      data:   json.data ?? json
    }
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTodayDate () {
  return new Date().toISOString().split('T')[0]
}

function getTomorrowDate () {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

function summariseLevel (risks) {
  const levels = risks.map(r => r.level).filter(Boolean)
  if (!levels.length) return null
  const max = Math.max(...levels)
  const avg = levels.reduce((a, b) => a + b, 0) / levels.length
  return { max, average: Math.round(avg * 10) / 10 }
}

function formatIncident (inc) {
  return {
    id:        inc.incident_id,
    date:      inc.date,
    datetime:  inc.datetime,
    type:      inc.natureza,
    type_code: inc.natureza_code,
    status:    inc.status,
    active:    inc.active,
    location: {
      district:  inc.district,
      concerto:  inc.concerto,
      freguesia: inc.freguesia,
      address:   inc.location,
      region:    inc.regiao,
      subregion: inc.sub_regiao,
      lat:       inc.lat,
      lng:       inc.lng
    },
    resources: {
      ground: inc.meios_terra,
      aerial: inc.meios_aereos,
      water:  inc.meios_agua
    }
  }
}
