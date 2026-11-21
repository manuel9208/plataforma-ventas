import { z } from 'zod';
import { ESTADOS_REPORTE, GIROS_REPORTE, ORDENES_REPORTE, TIPOS_PERIODO, validarRango } from '@plataforma/calculos';
import { fecha } from './comunes.validator.js';

const filtros = z.object({
  desde: fecha,
  hasta: fecha,
  // Varias sucursales separadas por coma: "3,5,8". Vacío = todas las del usuario.
  sucursales: z
    .string()
    .regex(/^\d{1,9}(,\d{1,9})*$/, 'Sucursales inválidas')
    .transform((s) => s.split(',').map(Number))
    .refine((l) => l.length <= 50, 'Demasiadas sucursales')
    .optional(),
  empleadoId: z.coerce.number().int().positive().optional(),
  estado: z.enum(ESTADOS_REPORTE.map((e) => e.id)).default('todas'),
  giro: z.enum(GIROS_REPORTE.map((g) => g.id)).default('todo'),
  orden: z.enum(ORDENES_REPORTE).default('fecha'),
  direccion: z.enum(['asc', 'desc']).default('desc'),
  limite: z.coerce.number().int().min(1).max(100).default(25),
  pagina: z.coerce.number().int().min(1).default(1),
});

const rangoOk = (q) => validarRango(q.desde, q.hasta).ok;
const rangoError = (q) => ({ message: validarRango(q.desde, q.hasta).error ?? 'Fechas inválidas', path: ['hasta'] });

export const ventasQuery = filtros.refine(rangoOk, rangoError);

// Las estadísticas usan los mismos filtros, sin orden ni páginas, y necesitan saber qué periodo se revisa
export const estadisticasQuery = filtros
  .omit({ orden: true, direccion: true, limite: true, pagina: true })
  .extend({
    periodo: z.enum(TIPOS_PERIODO),
    // Si el periodo aún no termina, comparar solo los mismos días
    hastaHoy: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
  })
  .refine(rangoOk, rangoError);

  // El consumo usa los mismos filtros, sin páginas, y se ordena por piezas o por dinero
export const consumoQuery = filtros
  .omit({ orden: true, direccion: true, limite: true, pagina: true })
  .extend({ orden: z.enum(['cantidad', 'dinero']).default('cantidad') })
  .refine(rangoOk, rangoError);

export const detalleParams = z.object({ id: z.string().uuid('Venta inválida') });