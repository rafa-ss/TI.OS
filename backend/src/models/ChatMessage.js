const mongoose = require('mongoose');

/**
 * Mensagens do chat interno entre membros da equipe.
 *
 * Cada mensagem tem:
 *  - from: quem enviou
 *  - to:   quem deve receber (null = broadcast para todos)
 *  - text: conteúdo
 *  - readBy: lista de IDs de quem já leu (pra controlar "não lidas")
 */
const chatMessageSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    to:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true }, // null = todos
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

chatMessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
