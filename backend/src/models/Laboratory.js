const mongoose = require('mongoose');

const STATUS = ['planejado', 'em_montagem', 'concluido', 'manutencao', 'desativado'];
const KINDS = ['laboratorio', 'administrativo'];

// Status de cada estação de trabalho (PC) no mapa visual
const STATION_STATUS = ['funcionando', 'manutencao', 'defeito', 'sem_equipamento'];

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

// Snapshot de um kit usado na montagem (apenas para EXIBIÇÃO).
// O inventário real continua em `equipments` (componentes explodidos).
const labKitComponentSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true, lowercase: true },
    condition: { type: String, enum: CONDITIONS, default: 'novo' },
    quantity: { type: Number, required: true, min: 1 }, // já multiplicado pela qtd de kits
  },
  { _id: false }
);

const labKitSchema = new mongoose.Schema(
  {
    kit: { type: mongoose.Schema.Types.ObjectId, ref: 'Kit' },
    slug: { type: String, trim: true },
    name: { type: String, required: true, trim: true }, // ex.: "Computador Completo"
    quantity: { type: Number, required: true, min: 1 },  // quantos kits
    components: { type: [labKitComponentSchema], default: [] },
  },
  { _id: false }
);

// Estação de trabalho (PC01, PC02, ...) — uma posição no mapa visual do lab.
// Identificada apenas pelo número (PCnn). Sem patrimônio/componentes detalhados.
const stationSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true },   // "PC01"
    index: { type: Number, required: true },              // 1, 2, 3...
    status: { type: String, enum: STATION_STATUS, default: 'funcionando' },
    notes: { type: String, default: '' },
    lastMaintenanceAt: { type: Date },     // última manutenção desta estação
    lastMovementAt: { type: Date },        // última movimentação
  },
  { _id: true }
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
    // Inventário REAL do laboratório (componentes individuais — fonte da verdade).
    // Inclui tanto itens avulsos quanto os componentes vindos de kits (explodidos).
    equipments: { type: [labEquipmentSchema], default: [] },
    // Snapshot dos kits usados na montagem (apenas para exibição na tela).
    kits: { type: [labKitSchema], default: [] },
    // === Monitoramento dos computadores (mini-mapa / vistoria) ===
    // Quantos PCs estão em cada estado. O "vazio" do mini-mapa é calculado
    // como (total de computadores no inventário) - (active + maintenance + defective).
    computerStatus: {
      active:      { type: Number, default: 0, min: 0 }, // funcionando (verde)
      maintenance: { type: Number, default: 0, min: 0 }, // em manutenção (amarelo)
      defective:   { type: Number, default: 0, min: 0 }, // com defeito (vermelho)
    },
    // Data da última vistoria/manutenção registrada por um técnico/admin.
    lastInspectionAt: { type: Date },
    // Data da próxima manutenção preventiva agendada.
    nextPreventiveAt: { type: Date },
    // Estações de trabalho (mapa visual). Geradas automaticamente conforme a
    // quantidade de computadores do inventário (PC01..PCnn).
    stations: { type: [stationSchema], default: [] },
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
laboratorySchema.statics.STATION_STATUS = STATION_STATUS;

// Garante no nível do BANCO que não existam dois termos com o mesmo número.
// Índice ÚNICO e PARCIAL: só vale para documentos com deliveryTermNumber
// preenchido (assim labs antigos sem número, ou com '', não conflitam).
laboratorySchema.index(
  { deliveryTermNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { deliveryTermNumber: { $type: 'string', $gt: '' } },
    name: 'uniq_deliveryTermNumber',
  }
);

module.exports = mongoose.model('Laboratory', laboratorySchema);
