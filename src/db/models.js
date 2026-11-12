import mongoose from 'mongoose'

mongoose.set('autoIndex', false)

// Indexes are declared and created in ./indexes.js (ensureIndexes).
// unique flags here document integrity constraints; they do not auto-build
// indexes because mongoose autoIndex is disabled.

const IncidentSchema = new mongoose.Schema({
    incident_id:   { type: String, required: true, unique: true },
    date:          { type: String },
    datetime:      { type: Date },
    natureza:      { type: String },
    natureza_code: { type: String },
    status:        { type: String },
    status_code:   { type: String },
    active:        { type: Boolean },
    district:      { type: String },
    concerto:      { type: String },
    freguesia:     { type: String },
    location:      { type: String },
    lat:           { type: Number },
    lng:           { type: Number },
    regiao:        { type: String },
    sub_regiao:    { type: String },
    meios_terra:   { type: Number },
    meios_aereos:  { type: Number },
    meios_agua:    { type: Number },
    last_seen:     { type: Date, default: Date.now }
})

const RiskSchema = new mongoose.Schema({
    dico:               { type: String, required: true },
    date:               { type: String, required: true },
    district:           { type: String },
    latitude:           { type: Number },
    longitude:          { type: Number },
    level:              { type: Number },
    fire_weather_index: { type: Number },
    temperature_max:    { type: Number },
    temperature_min:    { type: Number },
    humidity_max:       { type: Number },
    humidity_min:       { type: Number },
    wind_direction:     { type: String },
    precipitation_risk: { type: Number },
    rcm:                { type: Number },
    synced_at:          { type: Date, default: Date.now }
})

const WarningSchema = new mongoose.Schema({
    sourceId: { type: String, required: true, unique: true },
    text:     { type: String },
    label:    { type: String },
    source:   { type: String, default: 'fogos.pt' },
    syncedAt: { type: Date, default: Date.now }
})

export const Incident = mongoose.model('Incident', IncidentSchema)
export const Risk     = mongoose.model('Risk',     RiskSchema)
export const Warning  = mongoose.model('Warning',  WarningSchema)
