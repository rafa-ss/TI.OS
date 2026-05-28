const asyncHandler = require('../utils/asyncHandler');
const ServiceOrder = require('../models/ServiceOrder');
const School = require('../models/School');
const Equipment = require('../models/Equipment');
const AppError = require('../utils/AppError');
const { getPagination, paginate } = require('../utils/paginate');
const storageService = require('../services/storage.service');
const notificationService = require('../services/notification.service');
const orderPdfService = require('../services/orderPdf.service');

const populateRefs = [
  { path: 'school', select: 'name inep municipio' },
  { path: 'equipment', select: 'patrimonio type brand model' },
  { path: 'technician', select: 'name email role' },
  { path: 'createdBy', select: 'name email role' },
  { path: 'comments.author', select: 'name role' },
  { path: 'history.user', select: 'name role' },
];

// ===== helpers de permissão =====
function idStr(v) {
  if (!v) return null;
  return v._id ? v._id.toString() : v.toString();
}

/**
 * Quem iniciou o atendimento é o "dono operacional" da O.S.:
 *  - é o único que pode EDITAR a partir do início
 *  - é o único que pode FINALIZAR
 * Admin sempre tem override.
 */
function isStarter(order, user) {
  return order.technician && idStr(order.technician) === idStr(user._id);
}

function isCreator(order, user) {
  return order.createdBy && idStr(order.createdBy) === idStr(user._id);
}

/**
 * Aplica filtro de visibilidade conforme o perfil:
 *  - admin:      vê tudo
 *  - técnico:    só vê O.S. abertas (livres para pegar) + as que ele iniciou
 *  - atendente:  vê tudo
 *
 * Como pode já haver um $or de busca, juntamos com $and quando necessário.
 */
function applyRoleFilter(filter, user) {
  if (user.role !== 'tecnico') return filter;
  const roleScope = {
    $or: [
      { status: 'aberta' },
      { technician: user._id },
    ],
  };
  if (filter.$or) {
    // já tem um $or → combina com $and pra preservar os dois
    filter.$and = [
      { $or: filter.$or },
      roleScope,
    ];
    delete filter.$or;
  } else {
    Object.assign(filter, roleScope);
  }
  return filter;
}

// ===== endpoints =====

exports.list = asyncHandler(async (req, res) => {
  const { q, status, priority, school, technician, inep, patrimonio, late, from, to } = req.query;
  const filter = {};

  if (q) {
    filter.$or = [
      { number: new RegExp(q, 'i') },
      { requesterName: new RegExp(q, 'i') },
      { problemReported: new RegExp(q, 'i') },
      { patrimonio: new RegExp(q, 'i') },
      { inep: new RegExp(q, 'i') },
    ];
  }
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (school) filter.school = school;
  if (technician) filter.technician = technician;
  if (inep) filter.inep = inep;
  if (patrimonio) filter.patrimonio = patrimonio;

  if (from || to) {
    filter.openedAt = {};
    if (from) filter.openedAt.$gte = new Date(from);
    if (to) filter.openedAt.$lte = new Date(to);
  }

  if (late === 'true') {
    filter.dueDate = { $lt: new Date() };
    filter.status = { $nin: ['finalizada', 'entregue', 'cancelada'] };
  }

  // Filtro de visibilidade por perfil
  applyRoleFilter(filter, req.user);

  const pagination = getPagination(req.query);
  const data = await paginate(ServiceOrder, filter, pagination, populateRefs);
  res.json({ success: true, ...data });
});

exports.get = asyncHandler(async (req, res) => {
  const os = await ServiceOrder.findById(req.params.id).populate(populateRefs);
  if (!os) throw new AppError('O.S. não encontrada', 404);

  // Técnico só pode ver O.S. abertas ou que ele iniciou
  if (req.user.role === 'tecnico') {
    const isOpen = os.status === 'aberta';
    const isMine = os.technician && idStr(os.technician) === idStr(req.user._id);
    if (!isOpen && !isMine) {
      throw new AppError('Você não tem acesso a esta O.S.', 403);
    }
  }

  res.json({ success: true, order: os });
});

async function resolveSchoolAndEquipment(body) {
  if (body.school) {
    const sc = await School.findById(body.school).select('inep');
    if (sc) body.inep = sc.inep;
  }
  if (body.equipment) {
    const eq = await Equipment.findById(body.equipment).select(
      'patrimonio brand model serialNumber type'
    );
    if (eq) {
      body.patrimonio = body.patrimonio || eq.patrimonio;
      body.brandModel = body.brandModel || `${eq.brand} ${eq.model}`.trim();
      body.serialNumber = body.serialNumber || eq.serialNumber;
      body.equipmentType = body.equipmentType || eq.type;
    }
  }
  return body;
}

// QUALQUER usuário autenticado pode criar.
exports.create = asyncHandler(async (req, res) => {
  const body = await resolveSchoolAndEquipment({ ...req.body });
  body.createdBy = req.user._id;
  body.status = 'aberta';
  body.history = [{
    user: req.user._id,
    action: 'created',
    note: `O.S. criada por ${req.user.name} (${req.user.role})`,
  }];

  const os = await ServiceOrder.create(body);

  await notificationService.notifyRoles(['admin', 'tecnico'], {
    title: `Nova O.S. aberta ${os.number}`,
    message: `${os.requesterName} — ${os.problemReported.substring(0, 100)}`,
    type: 'info',
    link: `/ordens/${os._id}`,
  });

  const populated = await os.populate(populateRefs);
  res.status(201).json({ success: true, order: populated });
});

/**
 * EDITAR — só o técnico que INICIOU o atendimento, ou admin.
 * Enquanto a O.S. estiver "aberta" (sem técnico), o criador também pode editar.
 */
exports.update = asyncHandler(async (req, res) => {
  const os = await ServiceOrder.findById(req.params.id)
    .populate('createdBy', 'name role')
    .populate('technician', 'name role');
  if (!os) throw new AppError('O.S. não encontrada', 404);

  const isAdmin = req.user.role === 'admin';
  // Se já iniciou: só quem iniciou (technician) edita
  // Se ainda está aberta: o criador pode ajustar antes de iniciar
  let canEdit = isAdmin;
  if (!canEdit) {
    if (os.technician) {
      canEdit = isStarter(os, req.user);
    } else {
      canEdit = isCreator(os, req.user);
    }
  }

  if (!canEdit) {
    if (os.technician) {
      throw new AppError(
        'Apenas o técnico que iniciou o atendimento (ou administrador) pode editar esta O.S.',
        403
      );
    }
    throw new AppError(
      'Apenas o autor da O.S. (ou administrador) pode editar antes do início do atendimento.',
      403
    );
  }

  const body = await resolveSchoolAndEquipment({ ...req.body });
  const trackedFields = [
    'status', 'priority', 'technician', 'diagnosis',
    'serviceDone', 'dueDate', 'problemReported', 'equipmentType', 'serviceType',
  ];
  const changes = [];
  trackedFields.forEach((f) => {
    if (body[f] !== undefined && String(body[f]) !== String(os[f] || '')) {
      changes.push({
        user: req.user._id, action: 'updated', field: f,
        from: os[f], to: body[f],
      });
    }
  });

  Object.assign(os, body);
  if (changes.length) os.history.push(...changes);

  if (body.status === 'finalizada' && !os.closedAt) os.closedAt = new Date();
  if (body.status === 'entregue' && !os.deliveredAt) os.deliveredAt = new Date();

  await os.save();
  const populated = await os.populate(populateRefs);
  res.json({ success: true, order: populated });
});

/**
 * Iniciar atendimento — APENAS técnicos ou admins.
 * Quem clicar vira o "starter" (responsável pelo atendimento).
 */
exports.start = asyncHandler(async (req, res) => {
  if (!['admin', 'tecnico'].includes(req.user.role)) {
    throw new AppError('Apenas técnicos ou administradores podem iniciar uma O.S.', 403);
  }

  const os = await ServiceOrder.findById(req.params.id);
  if (!os) throw new AppError('O.S. não encontrada', 404);
  if (os.status !== 'aberta') {
    throw new AppError(`Esta O.S. já foi iniciada (status atual: ${os.status})`, 400);
  }

  os.status = 'em_andamento';
  os.technician = req.user._id;
  os.history.push({
    user: req.user._id,
    action: 'started',
    note: `Atendimento iniciado por ${req.user.name}`,
  });
  await os.save();

  await notificationService.notifyRoles(['admin'], {
    title: `O.S. ${os.number} em atendimento`,
    message: `Iniciada por ${req.user.name}`,
    type: 'info',
    link: `/ordens/${os._id}`,
  });

  const populated = await os.populate(populateRefs);
  res.json({ success: true, order: populated });
});

/**
 * Mudar status — APENAS o técnico que iniciou (starter) ou admin.
 * Atendentes nunca podem.
 */
exports.changeStatus = asyncHandler(async (req, res) => {
  const os = await ServiceOrder.findById(req.params.id)
    .populate('technician', 'name role')
    .populate('createdBy', 'name role');
  if (!os) throw new AppError('O.S. não encontrada', 404);

  const isAdmin = req.user.role === 'admin';
  if (!isAdmin && !isStarter(os, req.user)) {
    throw new AppError(
      'Apenas o técnico que iniciou esta O.S. (ou administrador) pode alterar o status.',
      403
    );
  }

  const { status, note, diagnosis } = req.body;
  if (os.status === status) {
    return res.json({ success: true, order: os });
  }

  if (status === 'finalizada') {
    const finalDiag = diagnosis || os.diagnosis;
    if (!finalDiag || !finalDiag.trim()) {
      throw new AppError('O diagnóstico técnico é obrigatório para finalizar a O.S.', 400);
    }
    os.diagnosis = finalDiag;
  } else if (diagnosis !== undefined) {
    os.diagnosis = diagnosis;
  }

  os.history.push({
    user: req.user._id, action: 'status_changed', field: 'status',
    from: os.status, to: status, note,
  });
  os.status = status;
  if (status === 'finalizada') os.closedAt = new Date();
  if (status === 'entregue') os.deliveredAt = new Date();

  await os.save();

  if (status === 'finalizada' && os.equipment) {
    await Equipment.findByIdAndUpdate(os.equipment, {
      $push: {
        maintenanceHistory: {
          serviceOrder: os._id,
          date: new Date(),
          description: os.diagnosis || os.serviceDone || os.problemReported,
          technician: os.technician,
        },
      },
    });
  }

  await notificationService.notifyRoles(['admin'], {
    title: `Status alterado em ${os.number}`,
    message: `Novo status: ${status}`,
    type: 'info',
    link: `/ordens/${os._id}`,
  });

  const populated = await os.populate(populateRefs);
  res.json({ success: true, order: populated });
});

exports.addComment = asyncHandler(async (req, res) => {
  const os = await ServiceOrder.findById(req.params.id);
  if (!os) throw new AppError('O.S. não encontrada', 404);
  os.comments.push({ author: req.user._id, text: req.body.text, internal: !!req.body.internal });
  os.history.push({ user: req.user._id, action: 'comment_added' });
  await os.save();
  const populated = await os.populate(populateRefs);
  res.status(201).json({ success: true, order: populated });
});

exports.uploadAttachments = asyncHandler(async (req, res) => {
  const os = await ServiceOrder.findById(req.params.id);
  if (!os) throw new AppError('O.S. não encontrada', 404);
  if (!req.files || !req.files.length) throw new AppError('Nenhum arquivo enviado', 400);

  const uploaded = [];
  for (const file of req.files) {
    const meta = await storageService.uploadFile(file, `os/${os._id}`);
    meta.uploadedBy = req.user._id;
    os.attachments.push(meta);
    uploaded.push(meta);
  }
  os.history.push({
    user: req.user._id, action: 'attachment_uploaded',
    note: `${uploaded.length} arquivo(s)`,
  });
  await os.save();
  res.status(201).json({ success: true, attachments: uploaded });
});

exports.removeAttachment = asyncHandler(async (req, res) => {
  const os = await ServiceOrder.findById(req.params.id);
  if (!os) throw new AppError('O.S. não encontrada', 404);
  const att = os.attachments.id(req.params.attId);
  if (!att) throw new AppError('Anexo não encontrado', 404);
  await storageService.deleteFile(att);
  att.deleteOne();
  os.history.push({ user: req.user._id, action: 'attachment_removed' });
  await os.save();
  res.json({ success: true });
});

exports.remove = asyncHandler(async (req, res) => {
  const os = await ServiceOrder.findById(req.params.id);
  if (!os) throw new AppError('O.S. não encontrada', 404);

  const isAdmin = req.user.role === 'admin';
  // Autor pode excluir SOMENTE enquanto a O.S. ainda está aberta (sem técnico)
  const isAuthorAndStillOpen = isCreator(os, req.user) && os.status === 'aberta';

  if (!isAdmin && !isAuthorAndStillOpen) {
    throw new AppError(
      'Apenas o administrador pode excluir esta O.S. (o autor só pode excluir antes do atendimento iniciar).',
      403
    );
  }

  // Remove anexos do storage também (limpa arquivos)
  if (os.attachments && os.attachments.length > 0) {
    for (const att of os.attachments) {
      try { await storageService.deleteFile(att); } catch (_) {}
    }
  }

  await os.deleteOne();
  res.json({ success: true, message: 'O.S. excluída com sucesso' });
});

/**
 * Imprimir / baixar O.S. em PDF — só permitido depois de FINALIZADA.
 * Qualquer usuário autenticado pode baixar.
 */
exports.printPdf = asyncHandler(async (req, res) => {
  const os = await ServiceOrder.findById(req.params.id).populate(populateRefs);
  if (!os) throw new AppError('O.S. não encontrada', 404);

  if (!['finalizada', 'entregue'].includes(os.status)) {
    throw new AppError(
      'Só é possível imprimir a O.S. após sua finalização.',
      400
    );
  }

  const buf = await orderPdfService.buildOrderPdf(os);
  const fname = `OS-${os.number.replace(/[\/\\]/g, '-')}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
  res.end(buf);
});

exports.applyRoleFilter = applyRoleFilter;