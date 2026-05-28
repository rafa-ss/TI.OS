const { z } = require('zod');

const createUserSchema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  role: z.enum(['admin', 'tecnico', 'atendente']).default('atendente'),
  permissions: z.array(z.string()).optional(),
  active: z.boolean().optional(),
  phone: z.string().optional(),
});

const updateUserSchema = createUserSchema.partial().extend({
  password: z.string().min(6).optional(),
});

module.exports = { createUserSchema, updateUserSchema };
