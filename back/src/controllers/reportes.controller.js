import { asyncHandler } from '../utils/asyncHandler.js';
import * as ventas from '../services/reportesVentas.service.js';
import * as exportarVentas from '../services/exportarVentas.service.js';

export const exportarVentasArchivo = asyncHandler(async (req, res) => {
  const r = await exportarVentas.exportar(req.usuario, req.empresa, req.datos.params.formato, req.datos.query, req.ip);
  res.set({
    'Content-Type': r.tipo,
    'Content-Disposition': `attachment; filename="${r.nombre}"`,
    'Cache-Control': 'no-store',
  });
  res.send(r.buffer);
});

export const opciones = asyncHandler(async (req, res) => {
  res.json(await ventas.opciones(req.usuario));
});

export const verVentas = asyncHandler(async (req, res) => {
  res.json(await ventas.ventas(req.usuario, req.datos.query));
});

export const verEstadisticas = asyncHandler(async (req, res) => {
  res.json(await ventas.estadisticas(req.usuario, req.empresa, req.datos.query));
});

export const verConsumo = asyncHandler(async (req, res) => {
  res.json(await ventas.consumo(req.usuario, req.empresa, req.datos.query));
});

export const verDetalle = asyncHandler(async (req, res) => {
  res.json(await ventas.detalleVenta(req.usuario, req.datos.params.id));
});

export const verAnalisis = asyncHandler(async (req, res) => {
  res.json(await ventas.analisis(req.usuario, req.empresa, req.datos.query));
});