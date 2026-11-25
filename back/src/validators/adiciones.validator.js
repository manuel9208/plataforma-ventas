import { z } from 'zod';
import { linea, articuloNota } from './ventas.validator.js';

// Lo que se agrega a una nota abierta: productos y artículos con servicios (mismo formato que una venta nueva).
// No lleva pagos ni descuentos: el cobro se hace aparte y solo aplican las promociones automáticas.
export const adicionBody = z
  .object({
    id: z.string().uuid('Operación inválida'),
    lineas: z.array(linea).default([]),
    articulos: z.array(articuloNota).default([]),
    // El total que vio la Caja: el servidor lo compara con el suyo, nunca lo usa para cobrar
    totalMostrado: z.number().min(0).max(9999999.99).optional(),
  })
  .strict()
  .refine((d) => d.lineas.length + d.articulos.length > 0, { message: 'No hay nada que agregar' });