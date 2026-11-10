const mongoose = require('mongoose');

// Cópias de nome e INEP preservam o histórico mesmo se o cadastro da escola mudar.
const internetRequestSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  schoolName: { type: String, required: true },
  inep: { type: String, required: true, index: true },
  contactName: { type: String, required: true },
  phone: { type: String, required: true },
  issueType: { type: String, required: true, enum: ['sem_internet', 'lenta_instavel', 'local_especifico', 'outro'] },
  description: { type: String, required: true },
  since: { type: String, required: true },
  status: { type: String, enum: ['recebida', 'verificada', 'encaminhada'], default: 'recebida', index: true },
  trackingHash: { type: String, required: true, unique: true, select: false },
  verifiedAt: Date,
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  forwardedAt: Date,
  forwardedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  providerProtocol: { type: String, default: '' },
  internalNotes: { type: String, default: '' },
  // Exclusão lógica: mantém responsável e motivo para auditoria.
  deletedAt: { type: Date, default: null, index: true },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deletionReason: { type: String, default: '', maxlength: 300 },
}, { timestamps: true });
internetRequestSchema.index({ createdAt: -1 });
module.exports = mongoose.model('InternetRequest', internetRequestSchema);
