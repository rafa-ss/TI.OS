const mongoose = require('mongoose');

const EQUIPMENT_TYPES = [
  'computador', 'notebook', 'impressora', 'roteador', 'nobreak', 'tablet', 'outro',
];

const EQUIPMENT_STATUS = [
  'em_estoque',
  'em_uso',
  'em_manutencao',
  'aguardando_peca',
  'inativo',
  'descartado',
];

const maintenanceHistorySchema = new mongoose.Schema(
  {
    serviceOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceOrder' },
    date: { type: Date, default: Date.now },
    description: { type: String, default: '' },
    technician: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

// Histórico de movimentação (transferência entre escolas / almoxarifado)
const movementSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    type: {
      type: String,
      enum: ['entrega', 'devolucao', 'transferencia', 'manutencao', 'descarte', 'outro'],
      default: 'transferencia',
    },
    fromSchool: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    fromLocation: { type: String, default: '' },
    toSchool: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    toLocation: { type: String, default: '' },
    receiverName: { type: String, default: '' }, // quem recebeu na escola
    receiverRole: { type: String, default: '' },
    receiverCpf: { type: String, default: '' },
    deliveryDocNumber: { type: String, default: '' }, // nº do termo gerado
    notes: { type: String, default: '' },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true, timestamps: false }
);

const equipmentSchema = new mongoose.Schema(
  {
    patrimonio: { type: String, required: true, unique: true, index: true, trim: true },
    type: { type: String, enum: EQUIPMENT_TYPES, required: true, index: true },
    brand: { type: String, default: '', trim: true },
    model: { type: String, default: '', trim: true },
    serialNumber: { type: String, default: '', trim: true, index: true },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', index: true },
    status: { type: String, enum: EQUIPMENT_STATUS, default: 'em_estoque', index: true },
    location: { type: String, default: '', trim: true },
    acquisitionDate: { type: Date },
    invoice: { type: String, default: '' },
    notes: { type: String, default: '' },
    qrCode: { type: String, default: '' }, // payload do QR
    maintenanceHistory: { type: [maintenanceHistorySchema], default: [] },
    movements: { type: [movementSchema], default: [] },
  },
  { timestamps: true }
);

equipmentSchema.statics.TYPES = EQUIPMENT_TYPES;
equipmentSchema.statics.STATUS = EQUIPMENT_STATUS;

module.exports = mongoose.model('Equipment', equipmentSchema);
