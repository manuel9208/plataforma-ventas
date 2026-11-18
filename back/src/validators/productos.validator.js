import { z } from 'zod';
import { CLAVES_UNIDAD } from '@plataforma/calculos';

const idNumero = z.number().int().positive();
const maxDecimales = (n) => (v) => Math.abs(v * 10 ** n - Math.round(v * 10 ** n)) < 1e-4;

const dinero = z.number().min(0, 'No puede ser negativo').max(9999999.99).refine(maxDecimales(2), 'Máximo 2 decimales');
const costo = z.number().min(0, 'No puede ser negativo').max(9999999).refine(maxDecimales(6), 'Máximo 6 decimales');
const factor = z.number().positive('Debe ser mayor a 0').max(1000000).refine(maxDecimales(6), 'Máximo 6 decimales');
const cantidad = z.number().min(0, 'No puede ser negativo').max(99999999).refine(maxDecimales(4), 'Máximo 4 decimales');
const porcentaje = z.number().min(0).max(100).refine(maxDecimales(2), 'Máximo 2 decimales');

const nombre = z.string().trim().min(2, 'Mínimo 2 caracteres').max(120);
const texto = (max) => z.string().trim().min(1).max(max);
const codigo = z
  .string()
  .trim()
  .regex(/^[0-9A-Za-z-]{3,30}$/, 'Solo letras, números y guiones (3 a 30 caracteres)');

const reglaMayoreo = z
  .object({
    cantidadMinima: z.number().positive('Debe ser mayor a 0').max(99999999).refine(maxDecimales(4), 'Máximo 4 decimales'),
    precio: dinero,
  })
  .strict();

const presentacion = z
  .object({
    id: idNumero.optional(),
    nombre: z.string().trim().min(1, 'Escribe el nombre').max(60),
    unidad: z.enum(CLAVES_UNIDAD),
    factor,
    precio: dinero.nullable(),
    seVende: z.boolean().default(true),
    seCompra: z.boolean().default(false),
    esBase: z.boolean(),
    codigos: z.array(codigo).max(10).default([]),
    generarInterno: z.boolean().default(false),
    preciosSucursal: z.record(z.string().regex(/^\d+$/), dinero).default({}),
    mayoreo: z.array(reglaMayoreo).max(10).default([]),
  })
  .strict();

const sucursal = z.object({ sucursalId: idNumero, stockMinimo: cantidad.default(0) }).strict();

const comunes = {
  descripcion: texto(500).nullable().optional(),
  marca: texto(60).nullable().optional(),
  costo: costo.nullable().optional(),
  mermaEsperadaPct: porcentaje.optional(),
  controlaInventario: z.boolean().optional(),
  llevaCaducidad: z.boolean().optional(),
  visiblePublico: z.boolean().optional(),
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
    unidadBase: z.enum(CLAVES_UNIDAD),
    presentaciones: z.array(presentacion).min(1).max(20),
    sucursales: z.array(sucursal).min(1, 'Elige al menos una sucursal').max(50),
  })
  .strict();

// Todo es opcional: la baja y la reactivación mandan solo { activo, motivoBaja }.
// Presentaciones y sucursales se mandan juntas.
export const actualizarBody = z
  .object({
    ...comunes,
    nombre: nombre.optional(),
    departamentoId: idNumero.optional(),
    tasaIvaId: idNumero.optional(),
    unidadBase: z.enum(CLAVES_UNIDAD).optional(),
    presentaciones: z.array(presentacion).min(1).max(20).optional(),
    sucursales: z.array(sucursal).min(1, 'Elige al menos una sucursal').max(50).optional(),
    activo: z.boolean().optional(),
    motivoBaja: texto(200).optional(),
  })
  .strict();