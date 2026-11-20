import { z } from 'zod';
import { FORMAS_PAGO, esFechaISO } from '@plataforma/calculos';
import { maxDecimales, pin, telefono } from './comunes.validator.js';
import { nombrePropio } from '../utils/texto.js';

const dinero = z.number().min(0).max(9999999.99);
const idNumero = z.number().int().positive();
const textoArticulo = z.string().trim().max(300).optional();

export const catalogoQuery = z.object({
  buscar: z.string().trim().max(60).optional(),
  limite: z.coerce.number().int().min(1).max(50).default(24),
  pagina: z.coerce.number().int().min(1).default(1),
});

export const escanearQuery = z.object({ codigo: z.string().trim().min(1).max(40) });

export const sugerenciasQuery = z.object({
  campo: z.enum(['marca', 'talla', 'color', 'modelo', 'textura']),
  buscar: z.string().trim().max(40).optional(),
});

const linea = z
  .object({
    presentacionId: idNumero,
    cantidad: z.number().positive().max(99999),
  })
  .strict();

const articulo = z
  .object({
    marca: textoArticulo,
    talla: textoArticulo,
    color: textoArticulo,
    modelo: textoArticulo,
    textura: textoArticulo,
    descripcion: textoArticulo,
  })
  .strict();

// Cada par o pieza lleva su propio servicio, sus extras y los datos del artículo
const servicioLinea = z
  .object({
    servicioId: idNumero,
    tipoArticuloId: idNumero,
    fechaPrometida: z.string().refine(esFechaISO, 'Fecha inválida').optional(),
    extraIds: z.array(idNumero).max(20).default([]),
    articulo,
  })
  .strict();

// Un servicio dentro de un artículo (los datos del artículo van una sola vez, arriba)
const servicioDeArticulo = z
  .object({
    servicioId: idNumero,
    tipoArticuloId: idNumero,
    fechaPrometida: z.string().refine(esFechaISO, 'Fecha inválida').optional(),
    extraIds: z.array(idNumero).max(20).default([]),
  })
  .strict();

// Un artículo físico (unos tenis) con uno o varios servicios y un comentario interno
const articuloNota = z
  .object({
    datos: articulo,
    comentario: z.string().trim().max(300).optional(),
    servicios: z.array(servicioDeArticulo).min(1, 'Agrega al menos un servicio al artículo').max(10),
  })
  .strict();

const pago = z
  .object({
    forma: z.enum(FORMAS_PAGO),
    monto: z.number().positive().max(9999999.99),
    recibido: dinero.optional(),
    referencia: z.string().trim().min(1).max(60).optional(),
  })
  .strict();

// Descuento manual: porcentaje por artículo, con motivo y la autorización de un encargado
const descuentoLinea = z
  .object({
    presentacionId: idNumero.optional(),
    servicioIndice: z.number().int().min(0).max(49).optional(),
    porcentaje: z.number().positive().max(99).refine(maxDecimales(2), 'Máximo 2 decimales'),
  })
  .strict()
  .refine((d) => (d.presentacionId != null) !== (d.servicioIndice != null), { message: 'Indica un producto o un servicio' });

const descuentosManuales = z
  .object({
    motivo: z.string().trim().min(3, 'Escribe el motivo').max(200),
    autorizacion: z.object({ telefono: telefono.optional(), pin }).strict(),
    lineas: z.array(descuentoLinea).min(1).max(50),
  })
  .strict();

export const crearVentaBody = z
  .object({
    id: z.string().uuid('Venta inválida'),
    lineas: z.array(linea).max(100).default([]),
    servicios: z.array(servicioLinea).max(50).default([]),
    articulos: z.array(articuloNota).max(25).default([]),
    // En una nota con servicios los pagos pueden venir vacíos (abono de $0)
    pagos: z.array(pago).max(6).default([]),
    descuentos: descuentosManuales.optional(),
    // El total que vio la Caja: el servidor lo compara con el suyo, nunca lo usa para cobrar
    totalMostrado: dinero.optional(),
    financiada: z.boolean().optional(),
    clienteId: z.string().uuid().optional(),
    clienteNuevo: z.object({ nombre: z.string().trim().min(2).max(80).transform(nombrePropio), telefono }).strict().optional(),
  })
  .strict()
  .refine((d) => d.lineas.length + d.servicios.length + d.articulos.length > 0, { message: 'El carrito está vacío' })
  .refine((d) => !(d.servicios.length && d.articulos.length), { message: 'Manda los servicios sueltos o por artículo, no ambos' })
  .refine((d) => !(d.clienteId && d.clienteNuevo), { message: 'Indica un cliente existente o uno nuevo, no ambos' });