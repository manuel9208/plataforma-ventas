import { z } from 'zod';
import { normalizarOrigen } from '../utils/origenesPermitidos.js';
import { zonaValida } from '../utils/zonasHorarias.js';
import { telefono, password, pin } from './comunes.validator.js';

export const idParams = z.object({ id: z.coerce.number().int().positive('Empresa inválida') });



const dominio = z
  .string()
  .trim()
  .max(200)
  .transform(normalizarOrigen)
  .refine((v) => v !== '', 'Dominio inválido (ejemplo: app.cliente.com)');

const dominios = z
  .array(dominio)
  .max(10, 'Máximo 10 dominios')
  .transform((lista) => [...new Set(lista)]);

const nombre = z.string().trim().min(2, 'Escribe el nombre').max(80);

export const crearEmpresaBody = z
  .object({
    nombre,
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9-]{3,40}$/, 'El slug solo lleva minúsculas, números y guiones (3 a 40)'),
    tipoNegocio: z.enum(['limpieza', 'super']),
    zonaHoraria: z.string().trim().refine(zonaValida, 'Zona horaria inválida'),
    moneda: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Moneda inválida'),
    dominios: dominios.default([]),
    sucursal: nombre,
    admin: z.object({ nombre, telefono, password, pin }).strict(),
  })
  .strict();

export const editarEmpresaBody = z
  .object({
    nombre: nombre.optional(),
    moneda: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Moneda inválida').optional(),
    dominios: dominios.optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'No hay cambios que guardar' });

export const motivoBody = z.object({ motivo: z.string().trim().min(3, 'Escribe el motivo').max(200) }).strict();

export const listaQuery = z.object({
  buscar: z.string().trim().max(60).optional(),
  estado: z.enum(['todas', 'activas', 'suspendidas']).default('todas'),
  limite: z.coerce.number().int().min(1).max(50).default(20),
  pagina: z.coerce.number().int().min(1).default(1),
});