const mongoose = require('mongoose');

const STATUS = ['planejado', 'em_montagem', 'concluido', 'manutencao', 'desativado'];
const KINDS = ['laboratorio', 'administrativo'];

const TYPES = [
  'computador','notebook','impressora','roteador','nobreak','tablet',
  'mouse','teclado','estabilizador','caixa_cabo_rj45','monitor','memoria_ram','fonte','outro',
];
const CONDITIONS = ['novo', 'usado', 'recondicionado'];

const labEquipmentSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true, lowercase: true },
    condition: { type: String, enum: CONDITIONS, default: 'novo' },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const labHistorySchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    action: String,
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: String,
  },
  { _id: false }
);

const laboratorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Tipo de espaço: 'laboratorio' (Laboratório de Informática) ou 'administrativo' (Setor Administrativo)
    kind: { type: String, enum: KINDS, default: 'laboratorio', index: true },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    responsibleTech: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    responsibles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    status: { type: String, enum: STATUS, default: 'planejado', index: true },
    assemblyDate: { type: Date },
    completionDate: { type: Date },
    notes: { type: String, default: '' },
    equipments: { type: [labEquipmentSchema], default: [] },
    deliveryTermNumber: { type: String, default: '' },
    returnedToStock: { type: Boolean, default: false },
    history: { type: [labHistorySchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

laboratorySchema.statics.STATUS = STATUS;
laboratorySchema.statics.KINDS = KINDS;
laboratorySchema.statics.TYPES = TYPES;
laboratorySchema.statics.CONDITIONS = CONDITIONS;

module.exports = mongoose.model('Laboratory', laboratorySchema);
