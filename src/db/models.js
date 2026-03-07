import mongoose from 'mongoose'

const IncidentSchema = new mongoose.Schema({
  incident_id:  { type: String, required: true, unique: true },
  date:         { type: String },        // DD-MM-YYYY
  datetime:     { type: Date },
  natureza:     { type: String },        // type of incident
  natureza_code:{ type: String },
  status:       { type: String },
  status_code:  { type: String },
  active:       { type: Boolean },
  district:     { type: String },
  concelho:     { type: String },
  freguesia:    { type: String },
  location:     { type: String },
  lat:          { type: Number },
  lng:          { type: Number },
  regiao:       { type: String },
  sub_regiao:   { type: String },
  meios_terra:  { type: Number },        // ground resources
  meios_aereos: { type: Number },        // aerial resources
  meios_agua:   { type: Number },        // water resources
  last_seen:    { type: Date, default: Date.now }
})

IncidentSchema.index({ district: 1, active: 1 })
IncidentSchema.index({ datetime: -1 })
IncidentSchema.index({ natureza_code: 1 })

export const Incident = mongoose.model('Incident', IncidentSchema)
