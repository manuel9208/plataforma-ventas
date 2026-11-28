import { z } from 'zod';
import { password, pin } from './comunes.validator.js';

const actual = z.string().min(1, 'Escribe tu contraseña actual').max(200);

export const passwordBody = z.object({ passwordActual: actual, passwordNueva: password }).strict();
export const pinBody = z.object({ passwordActual: actual, pin }).strict();