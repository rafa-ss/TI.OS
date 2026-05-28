const { z } = require('zod');

const TYPES = ['computador', 'notebook', 'impressora', 'roteador', 'nobreak', 'tablet', 'outro'];
const STATUS = ['em_estoque', 'em_uso', 'em_manutencao', 'aguardando_peca', 'inativo', 'descartado'];

const createSchema = z.object({
  patrimonio: z.string().min(1),
  type: z.enum(TYPES),
  brand: z.string().optional().default(''),
  model: z.string().optional().default(''),
  serialNumber: z.string().optional().default(''),
  school: z.string().optional(),
  status: z.enum(STATUS).optional().default('em_estoque'),
  location: z.string().optional().default(''),
  acquisitionDate: z.string().optional(),
  invoice: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

const updateSchema = createSchema.partial();

module.exports = { createSchema, updateSchema };
