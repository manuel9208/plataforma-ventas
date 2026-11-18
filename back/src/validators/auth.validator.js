import { z } from 'zod';
import { normalizarTelefono } from '../utils/telefono.js';

// Si el teléfono no es válido simplemente no coincide: el mensaje de error es el mismo
export const loginBody = z
  .object({
    telefono: z.string().max(30).transform(normalizarTelefono),
    password: z.string().min(1).max(200),
  })
  .strict();