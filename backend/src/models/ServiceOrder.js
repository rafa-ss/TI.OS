const mongoose = require('mongoose');
const Counter = require('./Counter');

const STATUS = [
  'aberta',
  'em_andamento',
  'aguardando_peca',
  'finalizada',
  'entregue',
  'cancelada',
];

const PRIORITY = ['baixa', 'media', 'alta', 'urgente'];

const SERVICE_TYPES = [
  'instalacao_programas',
  'manutencao_preventiva',
  'manutencao_corretiva',
  'formatacao',
  'configuracao_rede',
  'troca_peca',
  'instalacao_equipamento',
  'suporte_remoto',
  'visita_tecnica',
  'outro',
];

// Itens dos checklists de manutenção de laboratório
const PREVENTIVE_ITEMS = [
  'limpeza_fisica',
  'organizacao_cabos',
  'atualizacao_software',
  'verificacao_antivirus',
  'verificacao_rede',
  'verificacao_eletrica',
  'verificacao_perifericos',
];
const CORRECTIVE_ITEMS = [
  'equipamento_defeito',
  'troca_pecas',
  'substituicao_equipamento',
  'formatacao',
  'reinstalacao_sistema',
  'correcao_rede',
];

const attachmentSchema = new mongoose.Schema(
  {
    name: String,
    url: String,
    path: String,
    storage: { type: String, enum: ['supabase', 'local'], default: 'local' },
    mimeType: String,
    size: Number,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const commentSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    internal: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const historySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: String,
    field: String,
    from: mongoose.Schema.Types.Mixed,
    to: mongoose.Schema.Types.Mixed,
    note: String,
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const serviceOrderSchema = new mongoose.Schema(
  {
    number: { type: String, unique: true, index: true },

    // Solicitante
    requesterName: { type: String, required: true, trim: true },
    requesterPhone: { type: String, default: '' },
    requesterEmail: { type: String, default: '' },

    // Escola
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', index: true },
    inep: { type: String, index: true },

    // Equipamento
    equipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment' },
    equipmentType: { type: String, default: '' },
    patrimonio: { type: String, index: true, default: '' },
    brandModel: { type: String, default: '' },
    serialNumber: { type: String, default: '' },

    // === Laboratório (OS de manutenção de laboratório) ===
    laboratory: { type: mongoose.Schema.Types.ObjectId, ref: 'Laboratory', index: true },
    // Estações afetadas (snapshot dos códigos PC01, PC02...). Guardamos o code
    // e o id da estação para cruzar com o laboratório.
    stations: {
      type: [new mongoose.Schema({
        stationId: { type: mongoose.Schema.Types.ObjectId },
        code: { type: String, trim: true }, // "PC05"
      }, { _id: false })],
      default: [],
    },
    // Checklist de manutenção PREVENTIVA (itens marcados pelo técnico)
    preventiveChecklist: {
      type: [String],
      default: [],
      // valores possíveis: limpeza_fisica, organizacao_cabos, atualizacao_software,
      // verificacao_antivirus, verificacao_rede, verificacao_eletrica, verificacao_perifericos
    },
    // Checklist de manutenção CORRETIVA
    correctiveChecklist: {
      type: [String],
      default: [],
      // valores possíveis: equipamento_defeito, troca_pecas, substituicao_equipamento,
      // formatacao, reinstalacao_sistema, correcao_rede
    },

    // Tipo de serviço a ser realizado
    serviceType: { type: String, default: 'outro', index: true },
    serviceLocation: { type: String, enum: ['ctec', 'externa'], default: 'externa', index: true }, // onde o atendimento será feito

    // Atendimento
    problemReported: { type: String, required: true },
    diagnosis: { type: String, default: '' },
    serviceDone: { type: String, default: '' },

    technician: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    helpers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // técnicos auxiliares (vários)
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    priority: { type: String, enum: PRIORITY, default: 'media', index: true },
    status: { type: String, enum: STATUS, default: 'aberta', index: true },

    openedAt: { type: Date, default: Date.now },
    dueDate: { type: Date },
    closedAt: { type: Date },
    deliveredAt: { type: Date },

    attachments: { type: [attachmentSchema], default: [] },
    comments: { type: [commentSchema], default: [] },
    history: { type: [historySchema], default: [] },
  },
  { timestamps: true }
);

serviceOrderSchema.virtual('isLate').get(function () {
  if (!this.dueDate) return false;
  if (['finalizada', 'entregue', 'cancelada'].includes(this.status)) return false;
  return new Date(this.dueDate) < new Date();
});

serviceOrderSchema.set('toJSON', { virtuals: true });
serviceOrderSchema.set('toObject', { virtuals: true });

serviceOrderSchema.pre('save', async function (next) {
  if (this.isNew && !this.number) {
    const year = new Date().getFullYear();
    const ServiceOrder = this.constructor;

    // Estratégia anti-duplicidade: gera um número e verifica se já existe.
    // Se existir (ex.: importação manual deixou números "à frente"), avança
    // o contador automaticamente até achar um livre. Até 50 tentativas.
    let attempts = 0;
    while (attempts < 50) {
      const seq = await Counter.next(`os_${year}`);
      const candidate = `${String(seq).padStart(2, '0')}/${year}`;
      const exists = await ServiceOrder.findOne({ number: candidate }).select('_id').lean();
      if (!exists) {
        this.number = candidate;
        return next();
      }
      attempts++;
    }
    return next(new Error('Não foi possível gerar um número único após 50 tentativas'));
  }
  next();
});

serviceOrderSchema.statics.STATUS = STATUS;
serviceOrderSchema.statics.PRIORITY = PRIORITY;
serviceOrderSchema.statics.SERVICE_TYPES = SERVICE_TYPES;
serviceOrderSchema.statics.PREVENTIVE_ITEMS = PREVENTIVE_ITEMS;
serviceOrderSchema.statics.CORRECTIVE_ITEMS = CORRECTIVE_ITEMS;

serviceOrderSchema.index({ number: 'text', requesterName: 'text', problemReported: 'text' });

module.exports = mongoose.model('ServiceOrder', serviceOrderSchema);
