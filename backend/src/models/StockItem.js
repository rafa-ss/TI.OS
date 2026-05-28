const mongoose = require('mongoose');

const TYPES = ['computador', 'notebook', 'impressora', 'roteador', 'nobreak', 'tablet', 'outro'];
const CONDITIONS = ['novo', 'usado', 'recondicionado'];

/**
 * Lote de estoque — representa N unidades de um mesmo tipo/condição/local.
 */
const stockItemSchema = new mongoose.Schema(
  {
    type: { type: String, enum: TYPES, required: true, index: true },
    condition: { type: String, enum: CONDITIONS, default: 'novo', index: true },
    quantity: { type: Number, required: true, min: 0, default: 1 },
    location: { type: String, default: 'Almoxarifado SEMED', trim: true },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

stockItemSchema.statics.TYPES = TYPES;
stockItemSchema.statics.CONDITIONS = CONDITIONS;

module.exports = mongoose.model('StockItem', stockItemSchema);