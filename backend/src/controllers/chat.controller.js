const asyncHandler = require('../utils/asyncHandler');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');
const AppError = require('../utils/AppError');

const populate = [
  { path: 'from', select: 'name role email' },
  { path: 'to', select: 'name role email' },
];

/**
 * Lista TODOS os contatos disponíveis para iniciar uma conversa
 * (usado pela página /chat na coluna lateral).
 */
exports.contacts = asyncHandler(async (req, res) => {
  const me = req.user;
  const users = await User.find({ _id: { $ne: me._id }, active: true })
    .select('_id name role email avatarUrl lastSeenAt')
    .sort({ name: 1 });

  // calcula não-lidas por contato
  const unreadAgg = await ChatMessage.aggregate([
    {
      $match: {
        $or: [
          { to: me._id, readBy: { $ne: me._id } },
          { to: null, from: { $ne: me._id }, readBy: { $ne: me._id } },
        ],
      },
    },
    {
      $group: {
        _id: { from: '$from', isGeneral: { $eq: ['$to', null] } },
        count: { $sum: 1 },
      },
    },
  ]);

  const unreadByUser = {};
  let unreadGeneral = 0;
  for (const u of unreadAgg) {
    if (u._id.isGeneral) unreadGeneral += u.count;
    else unreadByUser[String(u._id.from)] = u.count;
  }

  const contacts = users.map((u) => ({
    _id: u._id,
    name: u.name,
    role: u.role,
    email: u.email,
    avatarUrl: u.avatarUrl || '',
    online: isOnline(u.lastSeenAt),
    unread: unreadByUser[String(u._id)] || 0,
  }));

  res.json({
    success: true,
    contacts,
    general: { unread: unreadGeneral },
  });
});

/**
 * Lista APENAS as conversas que já tiveram alguma mensagem trocada
 * (usado pela caixa "Mensagens recentes" do Dashboard).
 *
 * Retorna conversas privadas com pelo menos 1 mensagem entre o usuário
 * e a outra pessoa, ordenadas pela mais recente. O canal Geral só aparece
 * se tiver alguma mensagem.
 */
exports.conversations = asyncHandler(async (req, res) => {
  const me = req.user;
  const myId = me._id;

  // === Conversas privadas ===
  // Para cada par (me, outro), pega a última mensagem e a contagem de não-lidas
  const privateAgg = await ChatMessage.aggregate([
    {
      $match: {
        to: { $ne: null },
        $or: [{ from: myId }, { to: myId }],
      },
    },
    {
      $project: {
        text: 1,
        createdAt: 1,
        from: 1,
        to: 1,
        readBy: 1,
        // ID da "outra pessoa" na conversa
        other: {
          $cond: [{ $eq: ['$from', myId] }, '$to', '$from'],
        },
        isUnreadForMe: {
          $and: [
            { $ne: ['$from', myId] },
            { $not: [{ $in: [myId, '$readBy'] }] },
          ],
        },
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$other',
        lastMessage: { $first: '$$ROOT' },
        unread: {
          $sum: { $cond: ['$isUnreadForMe', 1, 0] },
        },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        contactId: '$_id',
        name: '$user.name',
        role: '$user.role',
        email: '$user.email',
        avatarUrl: '$user.avatarUrl',
        active: '$user.active',
        unread: 1,
        lastMessage: {
          text: '$lastMessage.text',
          createdAt: '$lastMessage.createdAt',
          fromMe: { $eq: ['$lastMessage.from', myId] },
        },
      },
    },
    // Remove usuários inativos / inexistentes
    { $match: { name: { $ne: null }, active: { $ne: false } } },
    { $sort: { 'lastMessage.createdAt': -1 } },
  ]);

  // === Canal Geral ===
  const generalLast = await ChatMessage.findOne({ to: null })
    .sort({ createdAt: -1 })
    .populate('from', 'name role')
    .lean();

  let general = null;
  if (generalLast) {
    const unreadGeneral = await ChatMessage.countDocuments({
      to: null,
      from: { $ne: myId },
      readBy: { $ne: myId },
    });
    general = {
      unread: unreadGeneral,
      lastMessage: {
        text: generalLast.text,
        createdAt: generalLast.createdAt,
        fromMe: String(generalLast.from?._id) === String(myId),
        fromName: generalLast.from?.name,
      },
    };
  }

  res.json({
    success: true,
    conversations: privateAgg,
    general,
  });
});

/**
 * Lista mensagens de uma conversa.
 */
exports.list = asyncHandler(async (req, res) => {
  const me = req.user;
  const target = req.query.with;
  if (!target) throw new AppError('Informe o parâmetro "with"', 400);

  let filter;
  if (target === 'general') {
    filter = { to: null };
  } else {
    filter = {
      $or: [
        { from: me._id, to: target },
        { from: target, to: me._id },
      ],
    };
  }

  const limit = Math.min(parseInt(req.query.limit || '200', 10), 500);
  const items = await ChatMessage.find(filter)
    .sort({ createdAt: 1 })
    .limit(limit)
    .populate(populate)
    .lean();

  res.json({ success: true, items });
});

exports.send = asyncHandler(async (req, res) => {
  const me = req.user;
  const { to, text } = req.body;
  if (!text || !text.trim()) throw new AppError('Mensagem vazia', 400);
  if (!to) throw new AppError('Informe o destinatário', 400);

  let toId = null;
  if (to !== 'general') {
    const exists = await User.findById(to).select('_id');
    if (!exists) throw new AppError('Usuário destinatário não encontrado', 404);
    toId = exists._id;
  }

  const msg = await ChatMessage.create({
    from: me._id,
    to: toId,
    text: text.trim(),
    readBy: [me._id],
  });

  const populated = await msg.populate(populate);
  res.status(201).json({ success: true, message: populated });
});

exports.markRead = asyncHandler(async (req, res) => {
  const me = req.user;
  const target = req.body.with;

  let filter;
  if (target === 'general') {
    filter = { to: null, from: { $ne: me._id }, readBy: { $ne: me._id } };
  } else {
    filter = { from: target, to: me._id, readBy: { $ne: me._id } };
  }
  await ChatMessage.updateMany(filter, { $addToSet: { readBy: me._id } });
  res.json({ success: true });
});

exports.unread = asyncHandler(async (req, res) => {
  const me = req.user;
  const since = req.query.since ? new Date(req.query.since) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const items = await ChatMessage.find({
    $or: [
      { to: me._id, readBy: { $ne: me._id } },
      { to: null, from: { $ne: me._id }, readBy: { $ne: me._id } },
    ],
    createdAt: { $gte: since },
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate(populate)
    .lean();
  res.json({ success: true, items });
});

/**
 * Marca o usuário como online (atualiza lastSeenAt).
 * Chamado a cada 30s pelo frontend.
 */
exports.presence = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $set: { lastSeenAt: new Date() } });
  res.json({ success: true });
});

// Considera online quem deu ping nos últimos 90 segundos
const ONLINE_WINDOW_MS = 90 * 1000;
function isOnline(lastSeenAt) {
  if (!lastSeenAt) return false;
  return (Date.now() - new Date(lastSeenAt).getTime()) < ONLINE_WINDOW_MS;
}
