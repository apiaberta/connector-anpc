import { Incident } from '../db/models.js'

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
      as_of:        new Date().toISOString(),
      by_district:  byDistrict.map(d => ({ district: d._id, count: d.count })),
      by_type:      byNatureza.map(d => ({ type: d._id, count: d.count }))
    }
  })
}

function formatIncident (inc) {
  return {
    id:          inc.incident_id,
    date:        inc.date,
    datetime:    inc.datetime,
    type:        inc.natureza,
    type_code:   inc.natureza_code,
    status:      inc.status,
    active:      inc.active,
    location: {
      district:  inc.district,
      concelho:  inc.concelho,
      freguesia: inc.freguesia,
      address:   inc.location,
      region:    inc.regiao,
      subregion: inc.sub_regiao,
      lat:       inc.lat,
      lng:       inc.lng
    },
    resources: {
      ground:  inc.meios_terra,
      aerial:  inc.meios_aereos,
      water:   inc.meios_agua
    }
  }
}
