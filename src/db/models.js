import mongoose from 'mongoose'

// ─── Incident ────────────────────────────────────────────────────────────────

const IncidentSchema = new mongoose.Schema({
  incident_id:  { type: String, required: true, unique: true },
  date:         { type: String },
  datetime:     { type: Date },
  natureza:     { type: String },
  natureza_code:{ type: String },
  status:       { type: String },
  status_code:  { type: String },
  active:       { type: Boolean },
  district:     { type: String },
  concerto:     { type: String },
  freguesia:    { type: String },
  location:     { type: String },
  lat:          { type: Number },
  lng:          { type: Number },
  regiao:       { type: String },
  sub_regiao:   { type: String },
  meios_terra:  { type: Number },
  meios_aereos:{ type: Number },
  meios_agua:  { type: Number },
  last_seen:   { type: Date, default: Date.now }
})

IncidentSchema.index({ district: 1, active: 1 })
IncidentSchema.index({ datetime: -1 })
IncidentSchema.index({ natureza_code: 1 })

// ─── Risk ───────────────────────────────────────────────────────────────────

const RiskSchema = new mongoose.Schema({
  dico:           { type: String, required: true },   // municipality DICO code e.g. "0105"
  date:           { type: String, required: true },   // forecast date YYYY-MM-DD
  district:       { type: String },                   // resolved district name
  latitude:       { type: Number },
  longitude:      { type: Number },
  level:          { type: Number },                  // fire risk 1-5 (ff_int_id)
  fire_weather_index: { type: Number },
  temperature_max:{ type: Number },
  temperature_min:{ type: Number },
  humidity_max:   { type: Number },
  humidity_min:   { type: Number },
  wind_direction: { type: String },
  precipitation_risk: { type: Number },
  rcm:            { type: Number },                  // fire danger Fosberg index
  synced_at:      { type: Date, default: Date.now }
})

RiskSchema.index({ dico: 1, date: 1 }, { unique: true })
RiskSchema.index({ date: 1, level: -1 })
RiskSchema.index({ district: 1, date: 1 })

// ─── Warning ────────────────────────────────────────────────────────────────

const WarningSchema = new mongoose.Schema({
  sourceId:   { type: String, required: true, unique: true },  // fogos.pt internal _id
  text:       { type: String },
  label:      { type: String },
  source:     { type: String, default: 'fogos.pt' },
  syncedAt:   { type: Date, default: Date.now }
})

WarningSchema.index({ syncedAt: -1 })

// ─── Exports ────────────────────────────────────────────────────────────────

export const Incident = mongoose.model('Incident', IncidentSchema)
export const Risk     = mongoose.model('Risk',     RiskSchema)
export const Warning  = mongoose.model('Warning',  WarningSchema)
