import { z } from 'zod';

const id = z.coerce.number().int().positive();
const clave = z.string().regex(/^[a-z0-9_]{3,60}$/, 'Clave inválida');

export const paramsEmpresa = z.object({ id: id.refine(Boolean, 'Empresa inválida') });
export const paramsGrupo = z.object({ id, grupo: z.string().regex(/^[a-z0-9_]{2,30}$/, 'Servicio inválido') });

export const queryAlcance = z.object({ sucursalId: id.optional() });
export const queryAlcanceObligatorio = z.object({ sucursalId: id });

// Cada valor: texto = guardar · "" o null = quitar · lo que no viene = se conserva
export const guardarBody = z
  .object({ valores: z.record(clave, z.string().trim().max(500).nullable()) })
  .strict()
  .refine((d) => Object.keys(d.valores).length <= 20, { message: 'Demasiados campos' });

export const revelarBody = z.object({ clave, sucursalId: id.optional() }).strict();