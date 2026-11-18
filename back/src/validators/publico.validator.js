import { z } from 'zod';

export const catalogoQuery = z.object({
  sucursalId: z.coerce.number().int().positive(),
  tipo: z.enum(['productos', 'servicios']).default('productos'),
  buscar: z.string().trim().max(60).optional(),
  limite: z.coerce.number().int().min(1).max(50).default(24),
  pagina: z.coerce.number().int().min(1).default(1),
});