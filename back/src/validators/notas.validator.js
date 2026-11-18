import { z } from 'zod';
import { FORMAS_PAGO, PESTANAS_NOTAS, esFechaISO } from '@plataforma/calculos';
import { nombrePropio } from '../utils/texto.js';
import { telefono } from './comunes.validator.js';

const idNumero = z.number().int().positive();
const textoArticulo = z.string().trim().max(300).optional();
const dinero = z.number().min(0).max(9999999.99);

export const idParams = z.object({ id: z.string().uuid('Nota inválida') });

export const listaQuery = z.object({
  pestana: z.enum(PESTANAS_NOTAS).default('cobrar'),
  buscar: z.string().trim().max(60).optional(),
  limite: z.coerce.number().int().min(1).max(50).default(15),
  pagina: z.coerce.number().int().min(1).default(1),
});

const pago = z
  .object({
    forma: z.enum(FORMAS_PAGO),
    monto: z.number().positive().max(9999999.99),
    recibido: dinero.optional(),
    referencia: z.string().trim().min(1).max(60).optional(),
  })
  .strict();

// El id del cobro lo genera la pantalla: si se reintenta por una falla de señal, no se cobra dos veces
export const cobrarBody = z
  .object({
    id: z.string().uuid('Cobro inválido'),
    pagos: z.array(pago).min(1, 'Agrega al menos un pago').max(6),
  })
  .strict();

export const estadoBody = z
  .object({
    estado: z.enum(['listo', 'en_espera']),
    partidaIds: z.array(z.string().uuid()).min(1).max(50).optional(),
    motivo: z.string().trim().min(3).max(200).optional(),
  })
  .strict();

export const correccionBody = z
  .object({
    pin: z.string().regex(/^\d{4}$/, 'El PIN tiene 4 dígitos'),
    motivo: z.string().trim().min(3, 'Escribe el motivo').max(200),
    cliente: z
      .union([
        z.object({ clienteId: z.string().uuid() }).strict(),
        z.object({ clienteNuevo: z.object({ nombre: z.string().trim().min(2).max(80).transform(nombrePropio), telefono }).strict() }).strict(),
      ])
      .optional(),
    articulos: z
      .array(
        z
          .object({
            partidaId: z.string().uuid(),
            marca: textoArticulo,
            talla: textoArticulo,
            color: textoArticulo,
            modelo: textoArticulo,
            textura: textoArticulo,
            descripcion: textoArticulo,
            fechaPrometida: z.string().refine(esFechaISO, 'Fecha inválida').optional(),
          })
          .strict()
      )
      .max(50)
      .optional(),
  })
  .strict()
  .refine((d) => d.cliente || (d.articulos && d.articulos.length), { message: 'No hay cambios que guardar' });