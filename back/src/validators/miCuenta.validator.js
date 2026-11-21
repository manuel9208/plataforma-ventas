import { z } from 'zod';
import { validarCumple, pinDebil } from '@plataforma/calculos';
import { correo, pin, telefono } from './comunes.validator.js';

const cumpleanos = z
  .object({ mes: z.number().int().min(1).max(12), dia: z.number().int().min(1).max(31) })
  .strict()
  .refine((c) => validarCumple(c.mes, c.dia), 'Ese día no existe en ese mes');

export const loginBody = z.object({ telefono, pin }).strict();

// Cambiar datos pide el PIN otra vez. El cliente cambia su correo y su cumpleaños, pero no los borra.
export const datosBody = z
  .object({ pin, correo: correo.optional(), cumpleanos: cumpleanos.optional() })
  .strict()
  .refine((d) => d.correo !== undefined || d.cumpleanos !== undefined, { message: 'No hay cambios que guardar' });

export const cambiarPinBody = z
  .object({
    pinActual: pin,
    pinNuevo: pin.refine((p) => !pinDebil(p), 'Elige un PIN menos obvio (nada de 1234 ni 1111)'),
  })
  .strict()
  .refine((d) => d.pinActual !== d.pinNuevo, { message: 'El PIN nuevo debe ser distinto al actual' });