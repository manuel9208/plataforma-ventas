import { z } from 'zod';
import { normalizarTelefono } from '../utils/telefono.js';

export const telefono = z
  .string()
  .max(30)
  .transform(normalizarTelefono)
  .refine((v) => v.length === 10, 'Debe tener 10 dígitos');

export const correo = z
  .string()
  .trim()
  .toLowerCase()
  .max(120)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Correo inválido');

export const password = z.string().min(8, 'Mínimo 8 caracteres').max(72, 'Máximo 72 caracteres');

export const pin = z.string().regex(/^\d{4}$/, 'Debe tener 4 dígitos');

export const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Fecha inválida');

  
export const maxDecimales = (n) => (v) => Math.abs(v * 10 ** n - Math.round(v * 10 ** n)) < 1e-4;

export const dinero = z
  .number()
  .min(0, 'No puede ser negativo')
  .max(9999999.99, 'Cantidad demasiado grande')
  .refine(maxDecimales(2), 'Máximo 2 decimales');