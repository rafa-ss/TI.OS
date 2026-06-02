const mongoose = require('mongoose');

/**
 * Atividade externa registrada manualmente pelos técnicos/atendentes
 * para fins de respaldo do ponto (ex.: montagem de laboratório,
 * visita técnica em escola, reunião, etc.).
 *
 * As atividades automáticas (vindas de O.S. e Laboratórios) não usam este model —
 * são geradas em tempo real pelo relatório.
 */
const activitySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true, index: true },
    startTime: { type: String, default: '' },   // ex.: "08:00"
    endTime: { type: String, default: '' },     // ex.: "12:00"
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    location: { type: String, default: '' },    // local livre (se não for escola)
    description: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['montagem_lab', 'visita_tecnica', 'manutencao', 'reuniao', 'treinamento', 'outro'],
      default: 'outro',
    },
  },
  { timestamps: true }
);

activitySchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('Activity', activitySchema);
