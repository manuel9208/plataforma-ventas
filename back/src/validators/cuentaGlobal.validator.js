import { z } from 'zod';
import { telefono, password } from './comunes.validator.js';

export const actualizarCuentaBody = z
  .object({
    nombre: z.string().trim().min(2, 'Mínimo 2 caracteres').max(80).optional(),
    telefono: telefono.optional(),
    password: password.optional(),
    passwordActual: z.string().min(1).max(200).optional(),
  })
  .strict();