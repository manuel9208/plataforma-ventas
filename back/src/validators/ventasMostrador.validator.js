import { z } from 'zod';
import { FORMAS_PAGO, esFechaISO } from '@plataforma/calculos';
import { telefono } from './comunes.validator.js';

const fecha = z.string().refine(esFechaISO, 'Fecha inválida');

export const ventasListaQuery = z
  .object({
    buscar: z.string().trim().max(60).optional(),
    sucursalId: z.coerce.number().int().positive().optional(),
    desde: fecha.optional(),
    hasta: fecha.optional(),
    limite: z.coerce.number().int().min(1).max(50).default(15),
    pagina: z.coerce.number().int().min(1).default(1),
  })
  .refine((d) => !d.desde || !d.hasta || d.desde <= d.hasta, { message: 'La fecha inicial no puede ser mayor a la final' });

const linea = z
  .object({
    partidaId: z.string().uuid(),
    cantidad: z.number().positive('La cantidad debe ser mayor a cero').max(99999),
  })
  .strict();

// El id lo genera la pantalla: si se reintenta por una falla de señal, no se devuelve dos veces
export const devolverBody = z
  .object({
    id: z.string().uuid('Devolución inválida'),
    lineas: z.array(linea).min(1, 'Elige qué se devuelve').max(100),
    forma: z.enum(FORMAS_PAGO).optional(),
    referencia: z.string().trim().min(1).max(60).optional(),
    motivo: z.string().trim().min(3, 'Escribe el motivo').max(200),
    autorizacion: z.object({ telefono: telefono.optional(), pin: z.string().regex(/^\d{4}$/, 'El PIN tiene 4 dígitos') }).strict(),
  })
  .strict()
  .refine((d) => new Set(d.lineas.map((l) => l.partidaId)).size === d.lineas.length, { message: 'Hay productos repetidos' });