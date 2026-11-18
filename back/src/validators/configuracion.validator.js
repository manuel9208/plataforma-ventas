import { z } from 'zod';
import { zonaValida } from '../utils/zonasHorarias.js';
import { telefono } from './comunes.validator.js';

const id = z.coerce.number().int().positive();

export const alcanceQuery = z.object({ sucursalId: id.optional() });
export const paramsSucursal = z.object({ id: id.refine(Boolean, 'Sucursal inválida') });

// Cada valor: dato = guardar · null = que la sucursal vuelva a usar el de la empresa
export const guardarAjustesBody = z
  .object({
    valores: z.record(
      z.string().regex(/^[a-zA-Z]{3,40}$/, 'Ajuste inválido'),
      // Horario (objeto) y días especiales (lista): su contenido lo valida shared/calculos/horarios.js
      z.union([z.boolean(), z.number(), z.string().max(700), z.null(), z.array(z.unknown()).max(80), z.record(z.string().max(10), z.unknown())])
    ),
  })
  .strict()
  .refine((d) => Object.keys(d.valores).length > 0 && Object.keys(d.valores).length <= 20, { message: 'No hay cambios que guardar' });

export const sucursalBody = z
  .object({
    nombre: z.string().trim().min(2, 'Escribe el nombre').max(80).optional(),
    telefono: z.union([telefono, z.literal('').transform(() => null), z.null()]).optional(),
    direccion: z.union([z.string().trim().max(200).transform((v) => v || null), z.null()]).optional(),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lon: z.number().min(-180).max(180).nullable().optional(),
    zonaHoraria: z.string().trim().refine(zonaValida, 'Zona horaria inválida').optional(),
    referencias: z.union([z.string().trim().max(300).transform((v) => v || null), z.null()]).optional(),
    mapaUrl: z
      .union([
        z
          .string()
          .trim()
          .max(300)
          .refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'El enlace debe empezar con http:// o https://')
          .transform((v) => v || null),
        z.null(),
      ])
      .optional(),
    esPrincipal: z.literal(true).optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'No hay cambios que guardar' })
  .refine((d) => (d.lat === undefined) === (d.lon === undefined) && (d.lat == null) === (d.lon == null), {
    message: 'La ubicación necesita latitud y longitud juntas',
  });