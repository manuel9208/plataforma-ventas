import { z } from 'zod';
import { dinero } from './comunes.validator.js';

const idNumero = z.number().int().positive();
const claveId = z.string().regex(/^\d+$/);
const nombre = z.string().trim().min(2, 'Mínimo 2 caracteres').max(120);
const texto = (max) => z.string().trim().min(1).max(max);

const precioTipo = z.object({ tipoArticuloId: idNumero, precio: dinero }).strict();
// { [sucursalId]: { [tipoArticuloId]: precio } }
const preciosSucursal = z.record(claveId, z.record(claveId, dinero));

const comunes = {
  descripcion: texto(500).nullable().optional(),
  tiempoDias: z.number().int().min(0, 'No puede ser negativo').max(365).nullable().optional(),
  visiblePublico: z.boolean().optional(),
  requiereCotizacion: z.boolean().optional(),
  contactoCotizacion: texto(300).nullable().optional(),
};

export const idParams = z.object({ id: z.coerce.number().int().positive() });

export const listarQuery = z.object({
  buscar: z.string().trim().max(60).optional(),
  activo: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  departamentoId: z.coerce.number().int().positive().optional(),
  limite: z.coerce.number().int().min(1).max(50).default(10),
  pagina: z.coerce.number().int().min(1).default(1),
});

export const crearBody = z
  .object({
    ...comunes,
    nombre,
    departamentoId: idNumero,
    tasaIvaId: idNumero,
    precios: z.array(precioTipo).min(1, 'Pon el precio de al menos un tipo de artículo').max(50),
    sucursalIds: z.array(idNumero).min(1, 'Elige al menos una sucursal').max(50),
    preciosSucursal: preciosSucursal.default({}),
    extraIds: z.array(idNumero).max(100).default([]),
  })
  .strict();

// Todo es opcional: la baja y la reactivación mandan solo { activo, motivoBaja }.
// Precios y sucursales se mandan juntos (y con ellos los extras).
export const actualizarBody = z
  .object({
    ...comunes,
    nombre: nombre.optional(),
    departamentoId: idNumero.optional(),
    tasaIvaId: idNumero.optional(),
    precios: z.array(precioTipo).min(1, 'Pon el precio de al menos un tipo de artículo').max(50).optional(),
    sucursalIds: z.array(idNumero).min(1, 'Elige al menos una sucursal').max(50).optional(),
    preciosSucursal: preciosSucursal.optional(),
    extraIds: z.array(idNumero).max(100).optional(),
    activo: z.boolean().optional(),
    motivoBaja: texto(200).optional(),
  })
  .strict();