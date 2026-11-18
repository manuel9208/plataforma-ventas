import { z } from 'zod';
import { FORMAS_PAGO } from '@plataforma/calculos';
import { telefono } from './comunes.validator.js';

const pin = z.string().regex(/^\d{4}$/, 'El PIN tiene 4 dígitos');
const motivo = z.string().trim().min(3, 'Escribe el motivo').max(200);
const referencia = z.string().trim().min(1).max(60).optional();
// Quien autoriza: si el que está en caja ya tiene el permiso basta su PIN; si no, teléfono y PIN de un encargado
const autorizacion = z.object({ telefono: telefono.optional(), pin }).strict();

// Los ids los genera la pantalla: si se reintenta por una falla de señal, no se hace dos veces
export const cancelarBody = z
  .object({
    id: z.string().uuid('Cancelación inválida'),
    partidaIds: z.array(z.string().uuid()).min(1, 'Elige qué se cancela').max(50),
    devolver: z.number().min(0).max(9999999.99).default(0),
    forma: z.enum(FORMAS_PAGO).optional(),
    referencia,
    motivo,
    autorizacion,
  })
  .strict()
  .refine((d) => new Set(d.partidaIds).size === d.partidaIds.length, { message: 'Hay artículos repetidos' })
  .refine((d) => d.devolver === 0 || d.forma, { message: 'Elige cómo se devuelve el dinero' });

export const reembolsarBody = z
  .object({
    id: z.string().uuid('Reembolso inválido'),
    monto: z.number().positive('El monto debe ser mayor a cero').max(9999999.99),
    forma: z.enum(FORMAS_PAGO),
    referencia,
    motivo,
    autorizacion,
  })
  .strict();