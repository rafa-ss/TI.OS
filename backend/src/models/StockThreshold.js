const mongoose = require('mongoose');

/**
 * Limite mínimo de estoque por tipo de equipamento.
 * Quando a quantidade "em_estoque" daquele tipo cair abaixo de "minQty",
 * o sistema gera alertas para administradores.
 */
const stockThresholdSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, unique: true, index: true },
    minQty: { type: Number, required: true, default: 5, min: 0 },
    note: { type: String, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StockThreshold', stockThresholdSchema);
