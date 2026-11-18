import { z } from 'zod';

const nombre = z.string().trim().min(2, 'Mínimo 2 caracteres').max(60, 'Máximo 60 caracteres');
const orden = z.number().int().min(0).max(9999);
const porcentaje = z
  .number()
  .min(0, 'No puede ser negativo')
  .max(100, 'Máximo 100')
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'Máximo 2 decimales');

export const idParams = z.object({ id: z.coerce.number().int().positive() });

export const listarQuery = z.object({
  buscar: z.string().trim().max(60).optional(),
  activo: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  limite: z.coerce.number().int().min(1).max(100).default(50),
  pagina: z.coerce.number().int().min(1).default(1),
});

export const crearDepartamentoBody = z.object({ nombre }).strict();
export const actualizarDepartamentoBody = z
  .object({ nombre: nombre.optional(), activo: z.boolean().optional() })
  .strict();

export const crearTipoBody = z.object({ nombre }).strict();
export const actualizarTipoBody = z
  .object({ nombre: nombre.optional(), orden: orden.optional(), activo: z.boolean().optional() })
  .strict();

export const crearTasaBody = z.object({ nombre, porcentaje }).strict();
export const actualizarTasaBody = z
  .object({
    nombre: nombre.optional(),
    porcentaje: porcentaje.optional(),
    activo: z.boolean().optional(),
    esDefecto: z.literal(true).optional(), // solo se puede marcar; la anterior se desmarca sola
  })
  .strict();

export const actualizarConfigBody = z
  .object({
    preciosIncluyenIva: z.boolean().optional(),
    permitirVentaSinExistencia: z.boolean().optional(),
  })
  .strict();