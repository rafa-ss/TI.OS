const { z } = require('zod');

const STATUS = ['aberta', 'em_andamento', 'aguardando_peca', 'finalizada', 'entregue', 'cancelada'];
const PRIORITY = ['baixa', 'media', 'alta', 'urgente'];
const SERVICE_TYPES = [
  'instalacao_programas', 'manutencao_preventiva', 'manutencao_corretiva',
  'formatacao', 'configuracao_rede', 'troca_peca',
  'instalacao_equipamento', 'suporte_remoto', 'visita_tecnica', 'outro',
];

/**
 * Enum tolerante: trata '' / null / undefined como ausência (aplica o default)
 * em vez de rejeitar com 400. Evita erros chatos quando o frontend manda
 * o campo vazio.
 */
const enumOrDefault = (values, def) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.enum(values).optional().default(def)
  );

const createSchema = z.object({
  requesterName: z.string().min(2),
  requesterPhone: z.string().optional().default(''),
  requesterEmail: z.string().optional().default(''),
  school: z.string().optional(),
  equipment: z.string().optional(),
  equipmentType: z.string().optional().default(''),
  patrimonio: z.string().optional().default(''),
  brandModel: z.string().optional().default(''),
  serialNumber: z.string().optional().default(''),
  serviceType: z.preprocess(
    (v) => {
      if (v === '' || v === null || v === undefined) return undefined;
      // compat: valor antigo do frontend → valor canônico do backend
      if (v === 'instalacao_software') return 'instalacao_programas';
      return v;
    },
    z.enum(SERVICE_TYPES).optional().default('outro')
  ),
  serviceLocation: enumOrDefault(['ctec', 'externa'], 'externa'),
  problemReported: z.string().min(3),
  diagnosis: z.string().optional().default(''),
  serviceDone: z.string().optional().default(''),
  technician: z.string().optional(),
  helpers: z.array(z.string()).optional(),
  priority: enumOrDefault(PRIORITY, 'media'),
  status: enumOrDefault(STATUS, 'aberta'),
  dueDate: z.string().optional(),
  // === Campos de migração (apenas admin pode usar) ===
  number: z.string().optional(),       // permite reaproveitar número de OS antiga
  openedAt: z.string().optional(),     // data de abertura customizada
  closedAt: z.string().optional(),     // data de conclusão customizada

  // === Campos de OS de Laboratório (manutenção preventiva/corretiva) ===
  laboratory: z.string().optional(),
  // estações afetadas: aceita array de codes ("PC05") ou objetos { code, stationId }
  stations: z.array(
    z.union([
      z.string(),
      z.object({ code: z.string().optional(), stationId: z.string().optional() }).passthrough(),
    ])
  ).optional(),
  preventiveChecklist: z.array(z.string()).optional(),
  correctiveChecklist: z.array(z.string()).optional(),
});

const updateSchema = createSchema.partial();

const statusSchema = z.object({
  status: z.enum(STATUS),
  note: z.string().optional(),
  diagnosis: z.string().optional(),
  // Permite registrar os checklists no momento da finalização
  preventiveChecklist: z.array(z.string()).optional(),
  correctiveChecklist: z.array(z.string()).optional(),
});

const commentSchema = z.object({
  text: z.string().min(1),
  internal: z.boolean().optional().default(true),
});

module.exports = { createSchema, updateSchema, statusSchema, commentSchema, STATUS, PRIORITY, SERVICE_TYPES };
