import { z } from 'zod';
import { telefono, correo } from './comunes.validator.js';
import { nombrePropio } from '../utils/texto.js';
import { validarCumple } from '@plataforma/calculos';

const nombre = z.string().trim().min(2, 'Mínimo 2 caracteres').max(80).transform(nombrePropio);
const notas = z.string().trim().min(1).max(500);
const cumpleanos = z
  .object({ mes: z.number().int().min(1).max(12), dia: z.number().int().min(1).max(31) })
  .strict()
  .refine((c) => validarCumple(c.mes, c.dia), 'Ese día no existe en ese mes');
// Para buscar: solo dígitos, de 1 a 10
const busquedaTelefono = z
  .string()
  .trim()
  .transform((s) => s.replace(/\D/g, ''))
  .refine((s) => s.length >= 1 && s.length <= 10, 'Teléfono inválido');

export const idParams = z.object({ id: z.string().uuid('Cliente inválido') });

export const listarQuery = z.object({
  telefono: busquedaTelefono.optional(),
  nombre: z.string().trim().min(1).max(60).optional(),
  activo: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  perfil: z.enum(['completo', 'incompleto']).optional(),
  limite: z.coerce.number().int().min(1).max(50).default(10),
  pagina: z.coerce.number().int().min(1).default(1),
});

export const crearBody = z
  .object({
    nombre,
    telefono,
    correo: correo.optional(),
    notas: notas.optional(),
    cumpleanos: cumpleanos.optional(),
    aceptaWhatsapp: z.boolean().default(false),
  })
  .strict();

export const actualizarBody = z
  .object({
    nombre: nombre.optional(),
    telefono: telefono.optional(),
    correo: correo.nullable().optional(),
    notas: notas.nullable().optional(),
    cumpleanos: cumpleanos.nullable().optional(),
    aceptaWhatsapp: z.boolean().optional(),
    activo: z.boolean().optional(),
  })
  .strict();

  export const articuloParams = z.object({
  id: z.string().uuid('Cliente inválido'),
  articuloId: z.string().uuid('Artículo inválido'),
});

export const bajaArticuloBody = z
  .object({ motivo: z.string().trim().min(3, 'Escribe el motivo').max(200) })
  .strict();