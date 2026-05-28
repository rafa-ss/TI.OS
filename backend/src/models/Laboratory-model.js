const mongoose = require('mongoose');

const STATUS = ['planejado', 'em_montagem', 'concluido', 'manutencao', 'desativado'];
const TYPES = ['computador', 'notebook', 'impressora', 'roteador', 'nobreak', 'tablet', 'outro'];
const CONDITIONS = ['novo', 'usado', 'recondicionado'];

const labEquipmentSchema = new mongoose.Schema(
  {
    type: { type: String, enum: TYPES, required: true },
    condition: { type: String, enum: CONDITIONS, default: 'novo' },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const labHistorySchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    action: String,    // ex.: 'criado', 'status_alterado', 'desativado'
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: String,
  },
  { _id: false }
);

const laboratorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    responsibleTech: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // legado (1 técnico)
    responsibles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],     // múltiplos responsáveis (técnicos e admins)
    status: { type: String, enum: STATUS, default: 'planejado', index: true },
    assemblyDate: { type: Date },
    completionDate: { type: Date },
    notes: { type: String, default: '' },
    equipments: { type: [labEquipmentSchema], default: [] },
    deliveryTermNumber: { type: String, default: '' }, // ex.: "13/2025"
    returnedToStock: { type: Boolean, default: false }, // controla se já devolveu ao estoque
    history: { type: [labHistorySchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

laboratorySchema.statics.STATUS = STATUS;
laboratorySchema.statics.TYPES = TYPES;
laboratorySchema.statics.CONDITIONS = CONDITIONS;

module.exports = mongoose.model('Laboratory', laboratorySchema);
