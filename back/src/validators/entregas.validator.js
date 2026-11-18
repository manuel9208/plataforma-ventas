import { z } from 'zod';
import { nombrePropio } from '../utils/texto.js';
import { telefono } from './comunes.validator.js';

const pin = z.string().regex(/^\d{4}$/, 'El PIN tiene 4 dígitos');

// El id de la entrega lo genera la pantalla: si se reintenta por falla de señal, no se entrega dos veces
export const entregarBody = z
  .object({
    id: z.string().uuid('Entrega inválida'),
    partidaIds: z.array(z.string().uuid()).min(1, 'Elige al menos un artículo').max(50),
    pin: pin.optional(),
    recoge: z.string().trim().min(2).max(80).transform(nombrePropio).optional(),
    autorizacion: z
      .object({
        telefono: telefono.optional(),
        pin,
        motivo: z.string().trim().min(3, 'Escribe el motivo').max(200),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((d) => new Set(d.partidaIds).size === d.partidaIds.length, { message: 'Hay artículos repetidos' });