import { z } from 'zod';
import { dinero } from './comunes.validator.js';

export const idParams = z.object({ id: z.string().uuid('Turno inválido') });

export const abrirBody = z.object({ fondoInicial: dinero }).strict();

// El conteo es obligatorio para todos menos el administrador global (el servicio lo exige)
export const cerrarBody = z
  .object({
    efectivoContado: dinero.optional(),
    dejadoManana: dinero.optional(),
  })
  .strict()
  .default({});