const { z } = require('zod');

const STATUS = ['aberta', 'em_andamento', 'aguardando_peca', 'finalizada', 'entregue', 'cancelada'];
const PRIORITY = ['baixa', 'media', 'alta', 'urgente'];
const SERVICE_TYPES = [
  'instalacao_programas', 'manutencao_preventiva', 'manutencao_corretiva',
  'formatacao', 'configuracao_rede', 'troca_peca',
  'instalacao_equipamento', 'suporte_remoto', 'visita_tecnica', 'outro',
];

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
  serviceType: z.enum(SERVICE_TYPES).optional().default('outro'),
  problemReported: z.string().min(3),
  diagnosis: z.string().optional().default(''),
  serviceDone: z.string().optional().default(''),
  technician: z.string().optional(),
  priority: z.enum(PRIORITY).optional().default('media'),
  status: z.enum(STATUS).optional().default('aberta'),
  dueDate: z.string().optional(),
});

const updateSchema = createSchema.partial();

const statusSchema = z.object({
  status: z.enum(STATUS),
  note: z.string().optional(),
  diagnosis: z.string().optional(),
});

const commentSchema = z.object({
  text: z.string().min(1),
  internal: z.boolean().optional().default(true),
});

module.exports = { createSchema, updateSchema, statusSchema, commentSchema, STATUS, PRIORITY, SERVICE_TYPES };
