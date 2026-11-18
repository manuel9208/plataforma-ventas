import { z } from 'zod';
import { dinero } from './comunes.validator.js';

// Mismos parámetros de lista y de id que el catálogo
export { idParams, listarQuery } from './catalogo.validator.js';

const idNumero = z.number().int().positive();
const nombre = z.string().trim().min(2, 'Mínimo 2 caracteres').max(80);
const preciosSucursal = z.record(z.string().regex(/^\d+$/), dinero);

export const crearBody = z
  .object({
    nombre,
    precio: dinero,
    tasaIvaId: idNumero,
    preciosSucursal: preciosSucursal.default({}),
  })
  .strict();

export const actualizarBody = z
  .object({
    nombre: nombre.optional(),
    precio: dinero.optional(),
    tasaIvaId: idNumero.optional(),
    preciosSucursal: preciosSucursal.optional(),
    activo: z.boolean().optional(),
  })
  .strict();