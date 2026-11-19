import { z } from 'zod';

const idNumero = z.number().int().positive();
const nombre = z.string().trim().min(2, 'Mínimo 2 caracteres').max(40, 'Máximo 40 caracteres');

export const idParams = z.object({ id: z.coerce.number().int().positive() });

export const listarQuery = z.object({
  sucursalId: z.coerce.number().int().positive().optional(),
  activo: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

export const usuariosQuery = z.object({ sucursalId: z.coerce.number().int().positive() });

export const crearBody = z.object({ sucursalId: idNumero, nombre }).strict();

export const actualizarBody = z
  .object({
    nombre: nombre.optional(),
    activo: z.boolean().optional(),
    anchoPapel: z.union([z.literal(58), z.literal(80)]).optional(),
    corteAutomatico: z.boolean().optional(),
    abrirCajon: z.boolean().optional(),
    imprimirArea: z.boolean().optional(),
  })
  .strict();

// cajaId vacío (null) = quitar la caja al empleado
export const asignarBody = z.object({ usuarioId: idNumero, cajaId: idNumero.nullable() }).strict();