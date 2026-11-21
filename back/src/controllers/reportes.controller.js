import { asyncHandler } from '../utils/asyncHandler.js';
import * as ventas from '../services/reportesVentas.service.js';

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