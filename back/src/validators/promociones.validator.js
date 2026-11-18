import { z } from 'zod';
import { DIAS } from '@plataforma/calculos';
import { fecha } from './comunes.validator.js';

const idNumero = z.number().int().positive();
const importe = z.number().positive().max(99999.99);

export const idParams = z.object({ id: z.coerce.number().int().positive() });

export const listaQuery = z.object({
  buscar: z.string().trim().max(60).optional(),
  limite: z.coerce.number().int().min(1).max(50).default(20),
  pagina: z.coerce.number().int().min(1).default(1),
});

export const buscarQuery = z.object({
  tipo: z.enum(['producto', 'servicio', 'presentacion']),
  buscar: z.string().trim().max(60).optional(),
});

// Aquí solo la forma de los datos. Las reglas (porcentaje máximo, horas, combos) viven en shared/calculos/promociones.js
export const promocionBody = z
  .object({
    nombre: z.string().trim().min(2, 'Escribe el nombre').max(60),
    tipo: z.enum(['descuento', 'happy_hour', 'combo']),
    modo: z.enum(['porcentaje', 'monto']).nullish(),
    valor: importe.nullish(),
    precioCombo: importe.nullish(),
    aplicaA: z.enum(['todo', 'seleccion']).default('todo'),
    objetivos: z.array(z.object({ tipo: z.enum(['departamento', 'producto', 'servicio']), id: idNumero }).strict()).max(100).default([]),
    items: z
      .array(
        z
          .object({
            presentacionId: idNumero.optional(),
            servicioId: idNumero.optional(),
            tipoArticuloId: idNumero.optional(),
            cantidad: z.number().int().min(1).max(20).default(1),
          })
          .strict()
      )
      .max(10)
      .default([]),
    sucursalIds: z.array(idNumero).max(50).default([]),
    desde: fecha.nullish(),
    hasta: fecha.nullish(),
    dias: z.array(z.enum(DIAS.map((d) => d.id))).max(7).nullish(),
    horaDesde: z.string().max(5).nullish(),
    horaHasta: z.string().max(5).nullish(),
  })
  .strict();

export const encendidaBody = z.object({ encendida: z.boolean() }).strict();
export const bajaBody = z.object({ motivo: z.string().trim().min(3, 'Escribe el motivo').max(200) }).strict();