import { z } from 'zod';
import { esFechaISO } from '@plataforma/calculos';

export const turnoParams = z.object({ turnoId: z.string().uuid('Corte inválido') });

const fecha = z.string().refine(esFechaISO, 'Fecha inválida');

export const listaQuery = z
  .object({
    sucursalId: z.coerce.number().int().positive().optional(),
    desde: fecha.optional(),
    hasta: fecha.optional(),
    resultado: z.enum(['cuadra', 'sobra', 'falta', 'sin_conteo']).optional(),
    limite: z.coerce.number().int().min(1).max(50).default(20),
    pagina: z.coerce.number().int().min(1).default(1),
  })
  .refine((d) => !d.desde || !d.hasta || d.desde <= d.hasta, { message: 'La fecha inicial no puede ser mayor a la final' });