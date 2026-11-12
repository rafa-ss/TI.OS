const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema(
  {
    inep: { type: String, required: true, unique: true, index: true, trim: true },
    name: { type: String, required: true, trim: true, index: true },
    municipio: { type: String, default: 'Abaetetuba', trim: true, index: true },
    uf: { type: String, default: 'PA', trim: true },
    situacao: { type: String, default: 'Ativa', trim: true, index: true },
    dependenciaAdm: { type: String, default: '' },
    localizacao: { type: String, default: '' },
    endereco: { type: String, default: '' },
    // Histórico das confirmações feitas a partir de solicitações do canal público.
    internetAddressHistory: { type: [{ previous: String, updated: String, request: { type: mongoose.Schema.Types.ObjectId, ref: 'InternetRequest' }, confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, confirmedAt: Date, _id: false }], default: [], select: false },
    importedFrom: { type: String, default: '' },
    lastImportedAt: { type: Date },
  },
  { timestamps: true }
);

schoolSchema.index({ name: 'text', inep: 'text', municipio: 'text' });

module.exports = mongoose.model('School', schoolSchema);
