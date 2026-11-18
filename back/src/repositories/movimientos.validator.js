import { z } from 'zod';
import { CATEGORIAS_GASTO } from '@plataforma/calculos';
import { nombrePropio } from '../utils/texto.js';
import { telefono } from './comunes.validator.js';

export const idParams = z.object({ id: z.string().uuid('Movimiento inválido') });

const monto = z.number().positive('El monto debe ser mayor a cero').max(9999999.99);
const pin = z.string().regex(/^\d{4}$/, 'El PIN tiene 4 dígitos');

// El id lo genera la pantalla: si se reintenta por una falla de señal, no se registra dos veces
export const crearBody = z.discriminatedUnion('tipo', [
  z
    .object({
      id: z.string().uuid('Movimiento inválido'),
      tipo: z.literal('gasto'),
      categoria: z.enum(CATEGORIAS_GASTO),
      concepto: z.string().trim().min(3, 'Escribe en qué se gastó').max(120),
      monto,
      referencia: z.string().trim().min(1).max(60).optional(),
    })
    .strict(),
  z
    .object({
      id: z.string().uuid('Movimiento inválido'),
      tipo: z.literal('retiro'),
      recibe: z.string().trim().min(2, 'Escribe quién recibe el efectivo').max(80).transform(nombrePropio),
      monto,
    })
    .strict(),
]);

export const anularBody = z
  .object({
    motivo: z.string().trim().min(3, 'Escribe el motivo').max(200),
    autorizacion: z.object({ telefono: telefono.optional(), pin }).strict(),
  })
  .strict();