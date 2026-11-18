import { z } from 'zod';
import { esFechaISO } from '@plataforma/calculos';

export const paramsEmpresa = z.object({ id: z.coerce.number().int().positive('Empresa inválida') });

export const paramsModulo = z.object({
  id: z.coerce.number().int().positive('Empresa inválida'),
  clave: z.string().regex(/^[a-z0-9_]{3,40}$/, 'Módulo inválido'),
});

export const guardarModuloBody = z
  .object({
    activo: z.boolean(),
    // null = usar el precio sugerido
    precioPropio: z.number().min(0, 'No puede ser negativo').max(9999999.99).nullable().default(null),
    venceEn: z.string().refine(esFechaISO, 'Fecha inválida').nullable().default(null),
    nota: z.string().trim().max(200).nullable().default(null),
  })
  .strict();