const mongoose = require('mongoose');

/**
 * KIT — Conjunto pré-definido de componentes que, ao ser selecionado na
 * montagem de um laboratório/setor, é "explodido" automaticamente em vários
 * itens de estoque (ex.: "Computador Completo" = 1 computador + 1 monitor +
 * 1 mouse + 1 teclado).
 *
 * Importante:
 *  - O kit é apenas uma CONVENIÊNCIA de seleção/exibição.
 *  - No banco/estoque os componentes continuam sendo controlados
 *    individualmente (o Laboratory guarda os componentes explodidos em
 *    `equipments`, que é a fonte da verdade do inventário).
 *  - Estrutura escalável: dá pra cadastrar quantos kits quiser pela tela
 *    de administração, com qualquer combinação de componentes.
 */

const CONDITIONS = ['novo', 'usado', 'recondicionado'];

const kitComponentSchema = new mongoose.Schema(
  {
    // Tipo do componente (livre, casa com os tipos do estoque). Ex.: 'computador'
    type: { type: String, required: true, trim: true, lowercase: true },
    // Condição exigida do componente no estoque
    condition: { type: String, enum: CONDITIONS, default: 'novo' },
    // Quantas unidades deste componente cada 1 kit consome
    quantityPerKit: { type: Number, required: true, min: 1, default: 1 },
  },
  { _id: false }
);

const kitSchema = new mongoose.Schema(
  {
    // Nome exibido ao usuário. Ex.: "Computador Completo"
    name: { type: String, required: true, trim: true },
    // Identificador estável (gerado a partir do nome). Ex.: "computador-completo"
    slug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    // Nome de ícone (lucide) usado no frontend. Opcional.
    icon: { type: String, default: 'Package' },
    active: { type: Boolean, default: true, index: true },
    components: {
      type: [kitComponentSchema],
      default: [],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: 'O kit precisa ter pelo menos 1 componente',
      },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

kitSchema.statics.CONDITIONS = CONDITIONS;

/** Gera um slug a partir de um texto (sem acentos, minúsculo, com hífens). */
kitSchema.statics.makeSlug = function makeSlug(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

module.exports = mongoose.model('Kit', kitSchema);
