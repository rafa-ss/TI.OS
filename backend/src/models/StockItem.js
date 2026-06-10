const mongoose = require('mongoose');

/**
 * Lista oficial de tipos sugeridos no formulário (frontend).
 * O backend aceita QUALQUER string como tipo — assim o usuário pode
 * cadastrar tipos novos sem precisar mexer em código.
 */
const TYPES = [
  'computador',
  //'notebook',
 // 'impressora',
  'roteador',
 // 'nobreak',
  //'tablet',
  'mouse',
  'teclado',
  'estabilizador',
 // 'caixa_cabo_rj45',
  'monitor',
  'memoria_ram',
 // 'fonte',
  //'outro',
];

const CONDITIONS = ['novo', 'usado', 'recondicionado'];

/**
 * Local padrão do estoque. Usado tanto no cadastro quanto no estorno
 * (devolução de equipamentos de laboratório) para garantir que os lotes
 * sejam mesclados no mesmo local e não dupliquem.
 */
const DEFAULT_LOCATION = 'Coordenação de tecnologia educacional';

/**
 * Lote de estoque — N unidades de um mesmo tipo/condição/local.
 * `type` é livre (aceita tipos customizados além dos sugeridos).
 */
const stockItemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    condition: { type: String, enum: CONDITIONS, default: 'novo', index: true },
    quantity: { type: Number, required: true, min: 0, default: 1 },
    location: { type: String, default: DEFAULT_LOCATION, trim: true },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

stockItemSchema.statics.TYPES = TYPES;
stockItemSchema.statics.CONDITIONS = CONDITIONS;
stockItemSchema.statics.DEFAULT_LOCATION = DEFAULT_LOCATION;

const StockItem = mongoose.model('StockItem', stockItemSchema);
StockItem.DEFAULT_LOCATION = DEFAULT_LOCATION;

module.exports = StockItem;
